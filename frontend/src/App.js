import React, { useState, useRef } from 'react';
import { Upload, FileText, Send, Moon, Sun, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const App = () => {
  // State management
  const [file, setFile] = useState(null);
  const [questions, setQuestions] = useState('');
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef(null);
  const API_URL = 'http://localhost:8000/api/v1/hackrx/run';
  const API_TOKEN = '83ed36577e07551b01b01c042d83a77a57df1cd94d7a95e65ee8b7324a47ad2c';

  // File validation
  const validateFile = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'message/rfc822'
    ];
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.eml'];
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    return allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);
  };

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    if (!validateFile(selectedFile)) {
      setError('Please select a valid PDF, DOCX, or EML file.');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB.');
      return;
    }
    
    setFile(selectedFile);
    setError('');
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Parse questions from textarea
  const parseQuestions = (text) => {
    return text
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .slice(0, 20); // Limit to 20 questions
  };

  // Submit handler
  const handleSubmit = async () => {
    
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    
    const questionList = parseQuestions(questions);
    if (questionList.length === 0) {
      setError('Please enter at least one question.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setAnswers([]);
    
    try {
      // For testing purposes, we'll use the file name as the document path
      // In a real implementation, you'd upload the file first and get a path/URL
      const payload = {
        documents: file.name, // This is simplified - in reality you'd upload the file first
        questions: questionList
      };
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': Bearer ${API_TOKEN}
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(API request failed: ${response.status} ${response.statusText});
      }
      
      const data = await response.json();
      
      if (data.answers && Array.isArray(data.answers)) {
        // Combine questions and answers
        const qaResults = questionList.map((question, index) => ({
          question,
          answer: data.answers[index] || 'No answer provided'
        }));
        setAnswers(qaResults);
      } else {
        throw new Error('Invalid response format from API');
      }
      
    } catch (err) {
      console.error('API Error:', err);
      setError(Failed to process request: ${err.message});
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setQuestions('');
    setAnswers([]);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const questionCount = parseQuestions(questions).length;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Document Query System
            </h1>
            <p className={`text-sm mt-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Upload a document and ask questions to get AI-powered answers
            </p>
          </div>
          
          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
            }`}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className={`p-6 rounded-lg border-2 border-dashed transition-all ${
            dragOver 
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
              : file 
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20' 
                : darkMode 
                  ? 'border-gray-600 bg-gray-800 hover:border-gray-500' 
                  : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,.docx,.doc,.eml"
              className="hidden"
            />
            
            <div className="text-center">
              {file ? (
                <div className="space-y-2">
                  <CheckCircle className="mx-auto text-green-500" size={48} />
                  <p className={`font-medium ${
                    darkMode ? 'text-green-400' : 'text-green-700'
                  }`}>
                    File Selected
                  </p>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                    darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <FileText size={16} className="mr-2" />
                    {file.name}
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`text-sm underline ${
                        darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      Choose different file
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className={`mx-auto ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} size={48} />
                  <p className={`font-medium ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Drop your document here or click to browse
                  </p>
                  <p className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Supports PDF, DOCX, and EML files (Max 10MB)
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload size={16} className="mr-2" />
                    Select File
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Questions Input Section */}
          <div className={`p-6 rounded-lg border ${
            darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
          }`}>
            <div className="flex justify-between items-center mb-3">
              <label className={`text-lg font-semibold ${
                darkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Your Questions
              </label>
              <span className={`text-sm ${
                questionCount > 20 
                  ? 'text-red-500' 
                  : darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {questionCount}/20 questions
              </span>
            </div>
            
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Enter your questions here, one per line...&#10;&#10;Example:&#10;What is the main topic of this document?&#10;Who are the key people mentioned?&#10;What are the important dates?"
              rows={6}
              className={`w-full p-3 rounded-lg border resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                darkMode 
                  ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400' 
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
              }`}
            />
            
            <p className={`text-sm mt-2 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              💡 Tip: Each line will be treated as a separate question. Maximum 20 questions allowed.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="text-red-500 mr-3" size={20} />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !file || questionCount === 0}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <Send size={20} className="mr-2" />
                  Submit Query
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Results Section */}
        {answers.length > 0 && (
          <div className={`mt-8 p-6 rounded-lg border ${
            darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 ${
              darkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              Results
            </h2>
            
            <div className="space-y-6">
              {answers.map((qa, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-100 bg-gray-50'
                }`}>
                  <div className="mb-3">
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                      darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                    }`}>
                      Question {index + 1}
                    </span>
                    <p className={`mt-2 font-medium ${
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      {qa.question}
                    </p>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${
                    darkMode ? 'bg-gray-800 border-l-4 border-green-500' : 'bg-white border-l-4 border-green-500'
                  }`}>
                    <p className={`text-sm font-medium mb-1 ${
                      darkMode ? 'text-green-400' : 'text-green-700'
                    }`}>
                      Answer:
                    </p>
                    <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      {qa.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`mt-12 text-center text-sm ${
          darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <p>Powered by FastAPI backend • Built for HackRX</p>
        </div>
      </div>
    </div>
  );
};

export default App;