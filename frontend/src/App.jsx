// import { useState, useRef } from 'react'

// function App() {
//   const [selectedFile, setSelectedFile] = useState(null)
//   const [filePath, setFilePath] = useState('')
//   const [questions, setQuestions] = useState([''])
//   const [answers, setAnswers] = useState([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [dragOver, setDragOver] = useState(false)
//   const fileInputRef = useRef(null)

//   // Handle file selection
//   const handleFileSelect = (file) => {
//     const allowedTypes = [
//       'application/pdf',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'application/msword',
//       'message/rfc822',
//       'application/vnd.ms-outlook'
//     ]
    
//     if (allowedTypes.includes(file.type) || file.name.endsWith('.eml')) {
//       setSelectedFile(file)
//       setError('')
//     } else {
//       setError('Please select a PDF, DOCX, or EML file.')
//       setSelectedFile(null)
//     }
//   }

//   // Handle drag and drop
//   const handleDragOver = (e) => {
//     e.preventDefault()
//     setDragOver(true)
//   }

//   const handleDragLeave = (e) => {
//     e.preventDefault()
//     setDragOver(false)
//   }

//   const handleDrop = (e) => {
//     e.preventDefault()
//     setDragOver(false)
//     const files = e.dataTransfer.files
//     if (files.length > 0) {
//       handleFileSelect(files[0])
//     }
//   }

//   // Handle file input change
//   const handleFileInputChange = (e) => {
//     if (e.target.files.length > 0) {
//       handleFileSelect(e.target.files[0])
//     }
//   }

//   // Add new question
//   const addQuestion = () => {
//     setQuestions([...questions, ''])
//   }

//   // Remove question
//   const removeQuestion = (index) => {
//     if (questions.length > 1) {
//       setQuestions(questions.filter((_, i) => i !== index))
//     }
//   }

//   // Update question
//   const updateQuestion = (index, value) => {
//     const newQuestions = [...questions]
//     newQuestions[index] = value
//     setQuestions(newQuestions)
//   }

//   // Submit form
//   const handleSubmit = async () => {
//     // Validation
//     if (!filePath.trim()) {
//       setError('Please enter the absolute file path.')
//       return
//     }

//     const validQuestions = questions.filter(q => q.trim() !== '')
//     if (validQuestions.length === 0) {
//       setError('Please enter at least one question.')
//       return
//     }

//     setLoading(true)
//     setError('')
//     setAnswers([])

//     try {
//       // Create the payload with actual file path
//       const payload = {
//         documents: filePath.trim(),
//         questions: validQuestions
//       }

//       console.log('Sending payload:', payload) // Debug log

//       // Make API request
//       const response = await fetch('http://localhost:8000/api/v1/hackrx/run', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(payload)
//       })

//       if (!response.ok) {
//         const errorText = await response.text()
//         throw new Error(`HTTP ${response.status}: ${errorText}`)
//       }

//       const data = await response.json()
      
//       if (data.answers) {
//         setAnswers(data.answers)
//       } else {
//         throw new Error('Invalid response format')
//       }

//     } catch (err) {
//       console.error('API Error:', err)
//       setError(`Failed to get answers: ${err.message}`)
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4">
//       <div className="max-w-4xl mx-auto">
//         {/* Header */}
//         <div className="text-center mb-8">
//           <h1 className="text-4xl font-bold text-white mb-2">
//             📄 Document Q&A System
//           </h1>
//           <p className="text-lg text-white/80">
//             Upload a document and ask questions to get AI-powered answers
//           </p>
//         </div>

//         <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          
//           {/* File Upload Section */}
//           <div className="mb-8">
//             <h2 className="text-xl font-semibold text-white mb-4">📎 Document Path</h2>
            
//             {/* File Path Input */}
//             <div className="mb-4">
//               <input
//                 type="text"
//                 value={filePath}
//                 onChange={(e) => setFilePath(e.target.value)}
//                 placeholder="Enter absolute file path (e.g., C:\Users\jasho\Documents\document.pdf)"
//                 className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
//               />
//               <p className="text-white/60 text-xs mt-2">
//                 💡 Tip: Copy the full path from File Explorer → Right-click file → "Copy as path"
//               </p>
//             </div>

//             {/* Optional: File Preview */}
//             <div
//               className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
//                 dragOver 
//                   ? 'border-blue-400 bg-blue-500/20' 
//                   : 'border-white/30 hover:border-white/50'
//               }`}
//               onDragOver={handleDragOver}
//               onDragLeave={handleDragLeave}
//               onDrop={handleDrop}
//             >
//               {selectedFile ? (
//                 <div className="space-y-2">
//                   <div className="text-green-400 text-4xl">✅</div>
//                   <p className="text-white font-semibold">{selectedFile.name}</p>
//                   <p className="text-white/70 text-sm">
//                     {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
//                   </p>
//                   <p className="text-white/60 text-xs">
//                     File selected for preview only - use path above
//                   </p>
//                   <button
//                     onClick={() => setSelectedFile(null)}
//                     className="text-red-400 hover:text-red-300 text-sm underline"
//                   >
//                     Remove file
//                   </button>
//                 </div>
//               ) : (
//                 <div className="space-y-4">
//                   <div className="text-white/70 text-4xl">📄</div>
//                   <div>
//                     <p className="text-white mb-2">
//                       Optional: Preview file here
//                     </p>
//                     <p className="text-white/60 text-sm">
//                       Drag & drop or click to preview (path required above)
//                     </p>
//                   </div>
//                   <button
//                     onClick={() => fileInputRef.current?.click()}
//                     className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition-all duration-200"
//                   >
//                     Choose File
//                   </button>
//                 </div>
//               )}
//             </div>
            
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept=".pdf,.docx,.doc,.eml"
//               onChange={handleFileInputChange}
//               className="hidden"
//             />
//           </div>

//           {/* Questions Section */}
//           <div className="mb-8">
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-xl font-semibold text-white">❓ Questions</h2>
//               <button
//                 onClick={addQuestion}
//                 className="bg-green-500/80 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
//               >
//                 + Add Question
//               </button>
//             </div>
            
//             <div className="space-y-3">
//               {questions.map((question, index) => (
//                 <div key={index} className="flex gap-3">
//                   <div className="flex-1">
//                     <input
//                       type="text"
//                       value={question}
//                       onChange={(e) => updateQuestion(index, e.target.value)}
//                       placeholder={`Question ${index + 1}...`}
//                       className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
//                     />
//                   </div>
//                   {questions.length > 1 && (
//                     <button
//                       onClick={() => removeQuestion(index)}
//                       className="bg-red-500/80 hover:bg-red-500 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200"
//                     >
//                       ✕
//                     </button>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Error Display */}
//           {error && (
//             <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
//               <p className="text-red-200 flex items-center gap-2">
//                 <span className="text-xl">⚠️</span>
//                 {error}
//               </p>
//             </div>
//           )}

//          const handleSubmit = async () => {
//   try {
//     setLoading(true);
//     setError("");
//     const response = await fetch("http://localhost:8000/api/v1/hackrx/run", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": "Bearer 83ed36577e07551b01b01c042d83a77a57df1cd94d7a95e65ee8b7324a47ad2c",
//       },
//       body: JSON.stringify({
//         documents: filePath,  // use the actual filePath from state
//         questions: questions,
//       }),
//     });

//     if (!response.ok) throw new Error("Something went wrong while fetching answers.");
    
//     const data = await response.json();
//     setAnswers(data.answers || []);
//   } catch (err) {
//     setError(err.message || "An error occurred.");
//   } finally {
//     setLoading(false);
//   }
// };


//           {/* Submit Button */}
//           <div className="mb-8">
//             <button
//               onClick={handleSubmit}
//               disabled={loading}
//               className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none shadow-lg"
//             >
//               {loading ? (
//                 <span className="flex items-center justify-center gap-3">
//                   <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
//                   Processing...
//                 </span>
//               ) : (
//                 '🚀 Get Answers'
//               )}
//             </button>
//           </div>

//           {/* Results Section */}
//           {answers.length > 0 && (
//             <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
//               <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
//                 <span className="text-2xl">💡</span>
//                 Answers
//               </h2>
              
//               <div className="space-y-6">
//                 {answers.map((answer, index) => (
//                   <div key={index} className="bg-white/10 rounded-xl p-5 border border-white/20">
//                     <div className="flex items-start gap-3">
//                       <div className="bg-blue-500/80 text-white rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm flex-shrink-0">
//                         {index + 1}
//                       </div>
//                       <div className="flex-1">
//                         <p className="text-white/80 font-medium mb-2">
//                           Q: {questions[index] || `Question ${index + 1}`}
//                         </p>
//                         <p className="text-white leading-relaxed">
//                           {answer}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Footer */}
//         <div className="text-center mt-8">
//           <p className="text-white/60 text-sm">
//             Powered by FastAPI + React + Tailwind CSS
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }

// export default App


import { useState, useRef } from 'react'
import axios from 'axios';

const runHackRx = async () => {
  const response = await axios.post('http://localhost:8000/api/v1/hackrx/run', {
    documents: 'C:/path/to/your/file.pdf',
    questions: ['What is the grace period?']
  }, {
    headers: {
      Authorization: 'Bearer 83ed36577e07551b01b01c042d83a77a57df1cd94d7a95e65ee8b7324a47ad2c'
    }
  });
  console.log('API response:', response.data);
};


function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [filePath, setFilePath] = useState('')
  const [questions, setQuestions] = useState([''])
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Handle file selection
  const handleFileSelect = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'message/rfc822',
      'application/vnd.ms-outlook'
    ]

    if (allowedTypes.includes(file.type) || file.name.endsWith('.eml')) {
      setSelectedFile(file)
      setError('')
    } else {
      setError('Please select a PDF, DOCX, or EML file.')
      setSelectedFile(null)
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  const addQuestion = () => {
    setQuestions([...questions, ''])
  }

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index, value) => {
    const newQuestions = [...questions]
    newQuestions[index] = value
    setQuestions(newQuestions)
  }

  // ✅ Correctly defined handleSubmit
  const handleSubmit = async () => {
    if (!filePath.trim()) {
      setError('Please enter the absolute file path.')
      return
    }

    const validQuestions = questions.filter(q => q.trim() !== '')
    if (validQuestions.length === 0) {
      setError('Please enter at least one question.')
      return
    }

    setLoading(true)
    setError('')
    setAnswers([])

    try {
      const payload = {
        documents: filePath.trim(),
        questions: validQuestions
      }

      const response = await fetch('http://localhost:8000/api/v1/hackrx/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 83ed36577e07551b01b01c042d83a77a57df1cd94d7a95e65ee8b7324a47ad2c',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      if (data.answers) {
        setAnswers(data.answers)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (err) {
      setError(`Failed to get answers: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📄 Document Q&A System</h1>
          <p className="text-lg text-white/80">Upload a document and ask questions to get AI-powered answers</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">

          {/* File Upload Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">📎 Document Path</h2>
            <div className="mb-4">
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Enter absolute file path (e.g., C:\\Users\\jasho\\Documents\\document.pdf)"
                className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <p className="text-white/60 text-xs mt-2">💡 Tip: Copy the full path from File Explorer → Right-click file → "Copy as path"</p>
            </div>

            {/* File Preview */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                dragOver ? 'border-blue-400 bg-blue-500/20' : 'border-white/30 hover:border-white/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="text-green-400 text-4xl">✅</div>
                  <p className="text-white font-semibold">{selectedFile.name}</p>
                  <p className="text-white/70 text-sm">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="text-white/60 text-xs">File selected for preview only - use path above</p>
                  <button onClick={() => setSelectedFile(null)} className="text-red-400 hover:text-red-300 text-sm underline">
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-white/70 text-4xl">📄</div>
                  <div>
                    <p className="text-white mb-2">Optional: Preview file here</p>
                    <p className="text-white/60 text-sm">Drag & drop or click to preview (path required above)</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition-all duration-200"
                  >
                    Choose File
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.eml"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* Questions Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">❓ Questions</h2>
              <button
                onClick={addQuestion}
                className="bg-green-500/80 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              >
                + Add Question
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      placeholder={`Question ${index + 1}...`}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  {questions.length > 1 && (
                    <button
                      onClick={() => removeQuestion(index)}
                      className="bg-red-500/80 hover:bg-red-500 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200 flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                {error}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="mb-8">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </span>
              ) : (
                '🚀 Get Answers'
              )}
            </button>
          </div>

          {/* Answers Display */}
          {answers.length > 0 && (
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <span className="text-2xl">💡</span>
                Answers
              </h2>

              <div className="space-y-6">
                {answers.map((answer, index) => (
                  <div key={index} className="bg-white/10 rounded-xl p-5 border border-white/20">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500/80 text-white rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white/80 font-medium mb-2">
                          Q: {questions[index] || `Question ${index + 1}`}
                        </p>
                        <p className="text-white leading-relaxed">{answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/60 text-sm">Powered by FastAPI + React + Tailwind CSS</p>
        </div>
      </div>
    </div>
  )
}

export default App
