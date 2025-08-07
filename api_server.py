# Suppress NumPy warnings on Windows
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning, module="numpy")

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, HttpUrl, field_validator
from typing import List, Union
import os
import tempfile
import requests
from pathlib import Path
import logging
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title="Document Processing API",
    description="API for processing documents and answering questions using embeddings + LLM",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers including Authorization
)


# Import functions from your hackv2.py
from hackv2 import (
    extract_meaningful_chunks,
    extract_docx_chunks,
    extract_email_chunks,
    parse_query,
    build_improved_faiss_index,
    search_relevant_chunks,
    get_structured_response,
    create_fallback_response
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Authentication
security = HTTPBearer()
VALID_TOKEN = "83ed36577e07551b01b01c042d83a77a57df1cd94d7a95e65ee8b7324a47ad2c"

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify the bearer token"""
    if credentials.credentials != VALID_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials

# Request/Response Models
class ProcessRequest(BaseModel):
    documents: Union[HttpUrl, str]
    questions: List[str]

    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one question is required')
        if len(v) > 20:
            raise ValueError('Maximum 20 questions allowed per request')
        return v

    @field_validator('documents')
    @classmethod
    def validate_documents(cls, v):
        if isinstance(v, str):
            if v.startswith('http'):
                return v
            v_abs = os.path.abspath(v)
            if not os.path.exists(v_abs):
                raise ValueError(f"File not found: {v_abs}")
            return v_abs
        raise ValueError("Document must be a URL or file path string")

class ProcessResponse(BaseModel):
    answers: List[str]

def download_file(url: str, allowed_extensions: List[str] = ['.pdf', '.docx', '.eml', '.msg']) -> str:
    try:
        logger.info(f"Downloading file from: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        file_ext = None
        if url.lower().endswith(tuple(allowed_extensions)):
            file_ext = Path(url).suffix.lower()
        else:
            content_type = response.headers.get('Content-Type', '').lower()
            if 'pdf' in content_type:
                file_ext = '.pdf'
            elif 'word' in content_type or 'officedocument' in content_type:
                file_ext = '.docx'
            elif 'message' in content_type:
                file_ext = '.eml'

        if not file_ext or file_ext not in allowed_extensions:
            raise ValueError(f"Unsupported file type. Allowed: {allowed_extensions}")

        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            tmp_file.write(response.content)
            tmp_path = tmp_file.name

        logger.info(f"File downloaded successfully to: {tmp_path}")
        return tmp_path

    except requests.RequestException as e:
        logger.error(f"Failed to download file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download document: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error processing download: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document: {str(e)}"
        )

def extract_chunks_by_type(file_path: str) -> list:
    file_ext = Path(file_path).suffix.lower()

    try:
        if file_ext == '.pdf':
            return extract_meaningful_chunks(file_path)
        elif file_ext == '.docx':
            return extract_docx_chunks(file_path)
        elif file_ext in ['.eml', '.msg']:
            try:
                return extract_email_chunks(file_path)
            except ImportError as ie:
                logger.warning(f"Email processing libraries not available: {ie}")
                return extract_basic_text_chunks(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")
    except Exception as e:
        logger.error(f"Error extracting chunks from {file_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )

def cleanup_file(file_path: str):
    try:
        if os.path.exists(file_path) and file_path.startswith(tempfile.gettempdir()):
            os.unlink(file_path)
            logger.info(f"Cleaned up temporary file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup file {file_path}: {e}")

def extract_basic_text_chunks(file_path: str) -> list:
    chunks = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            paragraphs = content.split('\n\n')
            for i, para in enumerate(paragraphs):
                clean_para = ' '.join(para.split())
                if len(clean_para) > 20:
                    chunks.append({
                        "text": clean_para,
                        "page": 1,
                        "type": "email_fallback"
                    })
    except Exception as e:
        logger.error(f"Failed to extract basic text from {file_path}: {e}")
    return chunks

@app.get("/")
async def root():
    return {"message": "Document Processing API is running", "version": "1.0.0"}

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "document-processing-api",
        "version": "1.0.0"
    }

@app.post("/api/v1/hackrx/run", response_model=ProcessResponse)
async def process_documents(
    request: ProcessRequest,
    token: str = Depends(verify_token)
):
    temp_file_path = None

    try:
        logger.info(f"Processing request with {len(request.questions)} questions")

        if request.documents.startswith('http'):
            temp_file_path = download_file(request.documents)
            file_path = temp_file_path
        else:
            file_path = request.documents
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Local file not found: {file_path}"
                )

        logger.info("Extracting chunks from document...")
        chunks = extract_chunks_by_type(file_path)

        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No meaningful content could be extracted from the document"
            )

        logger.info(f"Extracted {len(chunks)} chunks")

        logger.info("Building FAISS index...")
        try:
            model, index, metadatas = build_improved_faiss_index(chunks)
        except Exception as e:
            logger.error(f"Failed to build FAISS index: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to build search index"
            )

        answers = []

        for i, question in enumerate(request.questions):
            logger.info(f"Processing question {i+1}/{len(request.questions)}: {question[:100]}...")

            try:
                parsed_query = parse_query(question)
                relevant_chunks = search_relevant_chunks(
                    question, model, index, metadatas, k=10
                )
                try:
                    answer = get_structured_response(question, parsed_query, relevant_chunks)
                    if isinstance(answer, dict):
                        if 'justification' in answer:
                            answer = answer['justification']
                        else:
                            answer = str(answer)
                except Exception as llm_error:
                    logger.warning(f"LLM failed for question {i+1}, using fallback: {llm_error}")
                    fallback_response = create_fallback_response(parsed_query, relevant_chunks)
                    answer = fallback_response['justification']

                answers.append(answer)
                logger.info(f"Question {i+1} processed successfully")

            except Exception as e:
                logger.error(f"Error processing question {i+1}: {e}")
                answers.append(f"Error processing question: {str(e)}")

        logger.info("All questions processed successfully")
        return ProcessResponse(answers=answers)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if temp_file_path:
            cleanup_file(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")