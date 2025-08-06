import os
import sys
import re
import json
import pdfplumber
import numpy as np
import faiss
# import pickle
import requests
from tqdm import tqdm
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from typing import Dict, List, Any
from docx import Document

# === CONFIG ===
load_dotenv()
PPLX_API_KEY = os.getenv("PPLX_API_KEY")

# === STEP 1: IMPROVED TEXT EXTRACTION ===

def extract_meaningful_chunks(pdf_path: str) -> List[Dict[str, Any]]:
    """Extract meaningful chunks from PDF instead of fragmented table cells"""
    chunks = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            
            # Extract paragraph-level chunks
            paragraphs = text.split('\n\n')
            for para in paragraphs:
                clean_para = ' '.join(para.split())  # Clean whitespace
                if len(clean_para) > 50 and not is_header_or_footer(clean_para):
                    chunks.append({
                        "text": clean_para,
                        "page": page_num,
                        "type": "paragraph"
                    })
            
            # Extract table content more meaningfully
            tables = page.extract_tables()
            for table in tables:
                if table and len(table) > 1:
                    table_content = extract_table_content(table, page_num)
                    chunks.extend(table_content)
    
    return chunks

def is_header_or_footer(text: str) -> bool:
    """Filter out headers, footers, and noise"""
    unwanted_patterns = [
        "Bajaj Allianz", "www.bajajallianz.com", "Toll Free",
        "E-mail", "Reg. No.:", "UIN-", "Page", "GLOBAL HEALTH CARE",
        "Sl. No.", "LIST I", "LIST II"
    ]
    return any(pattern.lower() in text.lower() for pattern in unwanted_patterns)

def extract_table_content(table: List[List[str]], page_num: int) -> List[Dict[str, Any]]:
    """Extract meaningful content from tables"""
    chunks = []
    
    if not table or len(table) < 2:
        return chunks
    
    headers = [h.strip() if h else "" for h in table[0]]
    
    for row in table[1:]:
        # Skip empty or header-like rows
        if not any(cell and cell.strip() for cell in row):
            continue
            
        row_text = ""
        
        # Create meaningful descriptions for each row
        for i, cell in enumerate(row):
            if cell and cell.strip() and i < len(headers) and headers[i]:
                cell_clean = cell.strip()
                header_clean = headers[i].strip()
                
                # Skip meaningless entries
                if cell_clean.lower() in ['not mentioned', '', 'sl. no.'] or cell_clean.isdigit():
                    continue
                
                # Create readable text
                if header_clean.lower() in ['feature', 'benefit', 'coverage']:
                    row_text += f"{cell_clean}. "
                else:
                    row_text += f"{header_clean}: {cell_clean}. "
        
        if len(row_text.strip()) > 20:  # Only add if meaningful
            chunks.append({
                "text": row_text.strip(),
                "page": page_num,
                "type": "table_row"
            })
    
    return chunks


def extract_docx_chunks(docx_path: str) -> List[Dict[str, Any]]:
    chunks = []
    try:
        doc = Document(docx_path)
        for i, para in enumerate(doc.paragraphs):
            text = para.text.strip()
            if len(text) > 50 and not is_header_or_footer(text):
                chunks.append({
                    "text": text,
                    "page": i + 1,
                    "type": "docx_paragraph"
                })
    except Exception as e:
        print(f"⚠ Error reading DOCX file: {e}")
    return chunks


def extract_email_chunks(file_path: str) -> List[Dict[str, Any]]:
    """Extract meaningful chunks from email files (.eml, .msg)"""
    chunks = []
    
    try:
        if file_path.lower().endswith('.msg'):
            # Handle Outlook .msg files
            import extract_msg
            msg = extract_msg.Message(file_path)
            
            # Extract headers as chunks
            if msg.subject:
                chunks.append({
                    "text": f"Email Subject: {msg.subject}",
                    "page": 1,
                    "type": "email_header"
                })
            
            if msg.sender:
                chunks.append({
                    "text": f"From: {msg.sender}",
                    "page": 1,
                    "type": "email_header"
                })
            
            if msg.to:
                chunks.append({
                    "text": f"To: {msg.to}",
                    "page": 1,
                    "type": "email_header"
                })
            
            # Extract body
            if msg.body:
                body_paragraphs = msg.body.split('\n\n')
                for i, para in enumerate(body_paragraphs):
                    clean_para = ' '.join(para.split())
                    if len(clean_para) > 20:
                        chunks.append({
                            "text": clean_para,
                            "page": 1,
                            "type": "email_body"
                        })
            
            # Process attachments
            for attachment in msg.attachments:
                if hasattr(attachment, 'save'):
                    # Save attachment temporarily and process if it's a document
                    temp_path = f"temp_{attachment.longFilename}"
                    attachment.save(temp_path)
                    
                    if temp_path.lower().endswith(('.pdf', '.docx', '.txt')):
                        att_chunks = process_attachment(temp_path)
                        chunks.extend(att_chunks)
                    
                    # Clean up temp file
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
        
        elif file_path.lower().endswith('.eml'):
            # Handle .eml files
            import eml_parser
            
            with open(file_path, 'rb') as f:
                raw_email = f.read()
            
            ep = eml_parser.EmlParser()
            parsed_eml = ep.decode_email_bytes(raw_email)
            
            # Extract headers
            if 'header' in parsed_eml:
                if 'subject' in parsed_eml['header']:
                    chunks.append({
                        "text": f"Email Subject: {parsed_eml['header']['subject']}",
                        "page": 1,
                        "type": "email_header"
                    })
                
                if 'from' in parsed_eml['header']:
                    chunks.append({
                        "text": f"From: {parsed_eml['header']['from']}",
                        "page": 1,
                        "type": "email_header"
                    })
            
            # Extract body
            if 'body' in parsed_eml:
                for body_part in parsed_eml['body']:
                    if body_part.get('content_type') == 'text/plain':
                        body_text = body_part.get('content', '')
                        body_paragraphs = body_text.split('\n\n')
                        for para in body_paragraphs:
                            clean_para = ' '.join(para.split())
                            if len(clean_para) > 20:
                                chunks.append({
                                    "text": clean_para,
                                    "page": 1,
                                    "type": "email_body"
                                })
    
    except Exception as e:
        print(f"⚠ Error processing email file: {e}")
        # Fallback to basic text extraction
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                paragraphs = content.split('\n\n')
                for para in paragraphs:
                    clean_para = ' '.join(para.split())
                    if len(clean_para) > 20:
                        chunks.append({
                            "text": clean_para,
                            "page": 1,
                            "type": "email_fallback"
                        })
        except:
            pass
    
    return chunks

def process_attachment(file_path: str) -> List[Dict[str, Any]]:
    """Process email attachments that are documents"""
    if file_path.lower().endswith('.pdf'):
        return extract_meaningful_chunks(file_path)
    elif file_path.lower().endswith('.docx'):
        # Add your DOCX processing here
        return []  # Replace with your DOCX extraction function
    elif file_path.lower().endswith('.txt'):
        chunks = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                paragraphs = content.split('\n\n')
                for para in paragraphs:
                    clean_para = ' '.join(para.split())
                    if len(clean_para) > 20:
                        chunks.append({
                            "text": clean_para,
                            "page": 1,
                            "type": "attachment_text"
                        })
        except:
            pass
        return chunks
    return []

# === STEP 2: QUERY PARSING ===

def parse_query(query: str) -> Dict[str, Any]:
    """Extract structured information from natural language query - generic for any domain"""
    parsed = {
        "age": None,
        "gender": None,
        "procedure_or_item": None,
        "location": None,
        "duration_or_period": None,
        "category": None,
        "original_query": query
    }
    
    # Age extraction
    age_match = re.search(r'(\d{1,3})\s*[yY]?\s*[Mm]?', query)
    if age_match:
        parsed["age"] = int(age_match.group(1))
    
    # Gender extraction
    if re.search(r'\b(male|M|man|men)\b', query, re.IGNORECASE):
        parsed["gender"] = "male"
    elif re.search(r'\b(female|F|woman|women)\b', query, re.IGNORECASE):
        parsed["gender"] = "female"
    
    # Generic procedures/items/services (not just medical)
    procedures_items = {
        # Medical
        "knee": "knee surgery", "cataract": "cataract surgery", "heart": "cardiac procedure",
        "dental": "dental treatment", "surgery": "surgical procedure",
        # Legal/Contract
        "termination": "contract termination", "breach": "contract breach", "renewal": "contract renewal",
        # HR/Employment
        "leave": "leave application", "overtime": "overtime work", "promotion": "promotion request",
        # General
        "equipment": "equipment", "service": "service", "repair": "repair", "maintenance": "maintenance"
    }
    
    for key, value in procedures_items.items():
        if key.lower() in query.lower():
            parsed["procedure_or_item"] = value
            break
    
    # Location extraction (can be expanded for international)
    locations = ["pune", "mumbai", "delhi", "bangalore", "chennai", "hyderabad", "kolkata", 
                "ahmedabad", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "bhopal"]
    for location in locations:
        if location.lower() in query.lower():
            parsed["location"] = location.title()
            break
    
    # Duration/Period extraction (more generic)
    duration_patterns = [
        (r'(\d+)\s*[-\s]*month', "months"),
        (r'(\d+)\s*[-\s]*year', "years"),
        (r'(\d+)\s*[-\s]*day', "days"),
        (r'(\d+)\s*[-\s]*week', "weeks")
    ]
    
    for pattern, unit in duration_patterns:
        duration_match = re.search(pattern, query, re.IGNORECASE)
        if duration_match:
            parsed["duration_or_period"] = f"{duration_match.group(1)} {unit}"
            break
    
    # Category detection (domain identification)
    categories = {
        "insurance": ["insurance", "policy", "claim", "coverage", "premium"],
        "legal": ["contract", "agreement", "legal", "clause", "terms"],
        "hr": ["employee", "hr", "leave", "salary", "promotion", "performance"],
        "medical": ["medical", "health", "treatment", "surgery", "doctor", "hospital"],
        "financial": ["loan", "credit", "payment", "finance", "bank", "interest"]
    }
    
    for category, keywords in categories.items():
        if any(keyword.lower() in query.lower() for keyword in keywords):
            parsed["category"] = category
            break
    
    return parsed

# === STEP 3: IMPROVED FAISS SEARCH ===

def build_improved_faiss_index(chunks: List[Dict[str, Any]]):
    """Build FAISS index from meaningful chunks"""
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    vectors = []
    metadatas = []
    
    print(f"Processing {len(chunks)} chunks...")
    
    for chunk in tqdm(chunks, desc="Embedding chunks"):
        vector = model.encode(chunk["text"])
        vectors.append(vector)
        metadatas.append({
            "text": chunk["text"],
            "page": chunk["page"],
            "type": chunk["type"]
        })
    
    if not vectors:
        raise ValueError("No chunks to embed!")
    
    vec_np = np.array(vectors).astype("float32")
    dim = vec_np.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(vec_np)
    
    return model, index, metadatas

def search_relevant_chunks(query: str, model, index, metadatas, k=10):
    """Search for relevant chunks with better filtering"""
    # Search with original query
    query_vector = model.encode(query)
    query_np = np.array([query_vector]).astype("float32")
    D, I = index.search(query_np, k)
    
    results = []
    for i, distance in zip(I[0], D[0]):
        # More relaxed threshold to get results
        if distance < 1.5:  # Increased threshold
            results.append({
                **metadatas[i],
                "similarity_score": float(distance)
            })
    
    # If no results with threshold, return top 3 anyway
    if not results:
        for i in range(min(3, len(I[0]))):
            results.append({
                **metadatas[I[0][i]],
                "similarity_score": float(D[0][i])
            })
    
    return results

def create_fallback_response(parsed_query: Dict, retrieved_chunks: List[Dict]) -> Dict[str, Any]:
    """Create generic rule-based response when LLM fails - works for any document type"""
    if not retrieved_chunks:
        return {
            "decision": "unknown",
            "amount": "N/A",
            "justification": "No relevant information found in the provided documents."
        }
    
    # Generic approach - analyze the best matching chunks for any document type
    best_chunk = retrieved_chunks[0]
    chunk_text = best_chunk['text'].lower()
    
    # Look for positive/approval indicators (generic across domains)
    positive_indicators = [
        'approved', 'eligible', 'entitled', 'covered', 'included', 'allowed', 
        'permitted', 'authorized', 'valid', 'accepted', 'qualified', 'yes',
        'benefit', 'payable', 'reimbursed', 'compensated', 'supported'
    ]
    
    # Look for negative/rejection indicators
    negative_indicators = [
        'rejected', 'denied', 'excluded', 'not eligible', 'not covered', 
        'not allowed', 'prohibited', 'restricted', 'invalid', 'declined',
        'not applicable', 'not payable', 'limitation', 'exclude', 'no'
    ]
    
    # Look for conditional indicators (require more information)
    conditional_indicators = [
        'subject to', 'provided that', 'if', 'unless', 'condition', 'requirement',
        'must', 'shall', 'need to', 'dependent on', 'based on'
    ]
    
    # Look for amount/value indicators (monetary or quantitative)
    amount_indicators = [
        '₹', '$', 'rupees', 'dollars', 'amount', 'value', 'limit', 'maximum', 
        'minimum', 'sum', 'total', 'cost', 'fee', 'charge', 'price'
    ]
    
    # Count matches
    positive_matches = sum(1 for indicator in positive_indicators if indicator in chunk_text)
    negative_matches = sum(1 for indicator in negative_indicators if indicator in chunk_text)
    conditional_matches = sum(1 for indicator in conditional_indicators if indicator in chunk_text)
    
    # Extract potential amounts/values from the text
    amount_patterns = [
        r'₹\s*[\d,]+',  # ₹50,000
        r'\$\s*[\d,]+',  # $1,000
        r'rupees?\s+[\d,]+',  # rupees 50000
        r'rs\.?\s*[\d,]+',  # Rs. 50000
        r'usd?\s*[\d,]+',  # USD 1000
        r'amount.?₹\s[\d,]+',  # amount ₹50000
        r'limit.?₹\s[\d,]+',  # limit ₹50000
        r'maximum.?₹\s[\d,]+',  # maximum ₹50000
        r'\d+\s*%',  # 50%
        r'\d+\s*(days?|months?|years?)',  # 30 days, 6 months
    ]
    
    found_amounts = []
    for pattern in amount_patterns:
        matches = re.findall(pattern, chunk_text, re.IGNORECASE)
        found_amounts.extend(matches)
    
    # Decision logic based on indicators (domain-agnostic)
    if negative_matches > positive_matches and negative_matches > 0:
        decision = "rejected"
        amount = "N/A"
        justification = f"Negative indicators found in document (Page {best_chunk['page']}): {best_chunk['text'][:150]}..."
    elif positive_matches > 0:
        decision = "approved"
        if found_amounts:
            amount = found_amounts[0]  # Use first found amount/value
        else:
            amount = "As per document terms"
        justification = f"Positive indicators found in document (Page {best_chunk['page']}): {best_chunk['text'][:150]}..."
    elif conditional_matches > 0:
        decision = "conditional"
        amount = "Subject to conditions"
        justification = f"Conditional terms found - requires verification (Page {best_chunk['page']}): {best_chunk['text'][:150]}..."
    else:
        decision = "unknown"
        amount = "N/A"
        justification = f"Found related information but decision unclear (Page {best_chunk['page']}): {best_chunk['text'][:150]}..."
    
    return {
        "decision": decision,
        "amount": amount,
        "justification": justification
    }

# === STEP 4: IMPROVED LLM INTEGRATION ===

def get_structured_response(query: str, parsed_query: Dict, retrieved_chunks: List[Dict]) -> str:
    """Get natural language answer from LLM based only on document context"""

    if not retrieved_chunks:
        return "I couldn't find relevant information in the provided document excerpts."

    # Prepare document context
    context = ""
    for i, chunk in enumerate(retrieved_chunks):
        context += f"[Document Chunk {i+1} - Page {chunk['page']}]:\n{chunk['text']}\n\n"

    # Updated system prompt
    system_prompt = """You are a document assistant. 
Your task is to answer user queries based ONLY on the provided document chunks. 
Respond clearly in natural language and cite the page number if relevant. 
Do NOT use any external knowledge. 
If the answer isn't present in the document, reply: 
"I couldn't find relevant information in the provided document excerpts."""

    # Updated user prompt
    user_prompt = f"""You are given the following document excerpts:

{context}

Based only on the above information, answer the following question:

"{query}"

Please provide a clear, concise answer as found in the document. Reference the page number if helpful."""

    if not PPLX_API_KEY:
        print("⚠  No API key found, using fallback response")
        return "I couldn't find relevant information in the provided document excerpts."

    models_to_try = [
        "sonar",
        "sonar-pro",
        "llama-3.1-sonar-small-128k-online",
        "llama-3.1-sonar-large-128k-online"
    ]

    for model_name in models_to_try:
        try:
            url = "https://api.perplexity.ai/chat/completions"
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 500
            }

            headers = {
                "Authorization": f"Bearer {PPLX_API_KEY}",
                "Content-Type": "application/json"
            }

            print(f"🔧 Calling Perplexity model: {model_name}")
            response = requests.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                answer = response.json()["choices"][0]["message"]["content"]
                print(f"✅ Model '{model_name}' succeeded")
                return answer.strip()
            else:
                print(f"❌ API Error {response.status_code}: {response.text}")
                continue

        except Exception as e:
            print(f"❌ Error with model {model_name}: {str(e)}")
            continue

    print("⚠  All models failed, returning fallback answer.")
    return "I couldn't find relevant information in the provided document excerpts."

def download_pdf_from_url(url: str, save_path: str = "temp_downloaded.pdf") -> str:
    """Download PDF from a URL and save it locally"""
    response = requests.get(url)
    if response.status_code == 200 and "application/pdf" in response.headers.get("Content-Type", ""):
        with open(save_path, "wb") as f:
            f.write(response.content)
        print(f"✅ PDF downloaded successfully from {url}")
        return save_path
    else:
        raise ValueError(f"Failed to download PDF. Status: {response.status_code}, Content-Type: {response.headers.get('Content-Type')}")

# === MAIN EXECUTION ===
def main():
   print("🚀 Starting document processing pipeline...\n")
   
   # Configure your file here - can be URL or local file
   if len(sys.argv) > 1:
    file_input = sys.argv[1]
    print(f"📁 Using local file: {file_input}")
   else:
    print("❌ No file provided. Please specify a file path.")
    sys.exit(1)


   # file_input = "local_file.eml"  # or .msg, .docx, .pdf
   
   # Step 1: Extract meaningful chunks based on file type
   if file_input.startswith('http') and '.pdf' in file_input:
       try:
           file_path = download_pdf_from_url(file_input)
           print("📄 Extracting meaningful chunks from PDF...")
           chunks = extract_meaningful_chunks(file_path)
       except Exception as e:
           print(f"❌ Error downloading PDF: {e}")
           return
   elif file_input.lower().endswith('.pdf'):
       if not os.path.exists(file_input):
           print(f"❌ PDF file not found: {file_input}")
           return
       print("📄 Extracting meaningful chunks from PDF...")
       chunks = extract_meaningful_chunks(file_input)
   elif file_input.lower().endswith(('.eml', '.msg')):
       if not os.path.exists(file_input):
           print(f"❌ Email file not found: {file_input}")
           return
       print("📧 Extracting meaningful chunks from Email...")
       chunks = extract_email_chunks(file_input)
   elif file_input.lower().endswith('.docx'):
       if not os.path.exists(file_input):
           print(f"❌ DOCX file not found: {file_input}")
           return
       print("📝 Extracting meaningful chunks from DOCX...")
       chunks = extract_docx_chunks(file_input)  # You'll need this function
   else:
       print(f"❌ Unsupported file type: {file_input}")
       return
   
   print(f"✅ Extracted {len(chunks)} meaningful chunks")
   
   if not chunks:
       print("❌ No meaningful content extracted from file")
       return
    
    # Step 2: Build FAISS index

   print("\n🏗 Building FAISS index...")
   print(f"PPLX_API_KEY loaded: {bool(PPLX_API_KEY)}")

   model, index, metadatas = build_improved_faiss_index(chunks)
    
    # Step 3: Test queries - Updated for Personal Accident Insurance
   test_queries = [
       "What is the grace period for premium payment under the National Parivar Mediclaim Plus Policy?"
        # "What is the waiting period for pre-existing diseases (PED) to be covered?",
        # "Does this policy cover maternity expenses, and what are the conditions?",
        # "What is the waiting period for cataract surgery?",
        # "Are the medical expenses for an organ donor covered under this policy?",
        # "What is the No Claim Discount (NCD) offered in this policy?",
        # "Is there a benefit for preventive health check-ups?",
        # "How does the policy define a 'Hospital'?",
        # "What is the extent of coverage for AYUSH treatments?",
        # "Are there any sub-limits on room rent and ICU charges for Plan A?"
                        
    ]
    
   all_final_responses = []
   for query in test_queries:
        print(f"\n" + "="*50)
        print(f"🔍 Query: {query}")
        
        # Parse query
        parsed = parse_query(query)
        print(f"📋 Parsed: {parsed}")
        
        # Search documents
        results = search_relevant_chunks(query, model, index, metadatas, k=100)
        print(f"\n📚 Found {len(results)} relevant chunks:")
        
        for i, result in enumerate(results[:5]):
            print(f"  {i+1}. (Page {result['page']}, Score: {result['similarity_score']:.3f})")
            print(f"     {result['text'][:200]}...")
        
        # Debug: Show what keywords the search might be missing
        print(f"\n🔍 Debug: Searching for keywords like: {query.lower().split()}")
        
        # Let's also try keyword-based search as backup
        keyword_matches = []
        query_words = [w.lower() for w in query.split() if len(w) > 3]
        
        for i, meta in enumerate(metadatas):
            text_lower = meta['text'].lower()
            matches = sum(1 for word in query_words if word in text_lower)
            if matches > 0:
                keyword_matches.append({
                    **meta,
                    "keyword_matches": matches,
                    "chunk_index": i
                })
        
        keyword_matches.sort(key=lambda x: x['keyword_matches'], reverse=True)
        
        if keyword_matches:
            print(f"\n🔑 Keyword-based matches found: {len(keyword_matches[:3])}")
            for i, match in enumerate(keyword_matches[:3]):
                print(f"  {i+1}. (Page {match['page']}, {match['keyword_matches']} matches)")
                print(f"     {match['text'][:200]}...")
        
        # Get structured response
        print(f"\n🧠 Getting LLM response...")
        final_response = get_structured_response(query, parsed, results)
        print(f"✅ Final Response:")
        # Storing the response in a new list
        all_final_responses.append(final_response) 
        # Printing the response as it's generated
        print(json.dumps(final_response, indent=2)) 


if __name__ == "__main__":
    main()


#shlokn678