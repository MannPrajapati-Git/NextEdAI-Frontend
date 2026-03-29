import React, { useState, useEffect, useRef } from "react";
import { examAPI } from "../../utils/api";
import NotificationModal from "../../components/NotificationModal/NotificationModal";
import ConfirmationModal from "../../components/ConfirmationModal/ConfirmationModal";
import "./TeacherExams.css";

const Icons = {
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  ),
  Sparkles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
  ),
  Trash: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
  ),
  Analytics: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  )
};

const TeacherExams = ({ classroom, teacherName }) => {
  const [currentView, setCurrentView] = useState("dashboard"); // 'dashboard', 'create-manual', 'create-ai', 'students-list', 'analytics'
  const [aiInitialData, setAiInitialData] = useState(null); // Contains generated AI exam data
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedExam, setSelectedExam] = useState(null); // Used for students list
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null); // Used for analytics view

  const [notification, setNotification] = useState({ isOpen: false, title: "", message: "", type: "success" });
  const [confirmation, setConfirmation] = useState({ isOpen: false, type: "", id: null, title: "", message: "" });

  const fetchExams = React.useCallback(async () => {
    setIsLoading(true);
    const result = await examAPI.getClassroomExams(classroom._id);
    if (result.success) {
      setExams(result.data.exams);
    }
    setIsLoading(false);
  }, [classroom._id]);

  useEffect(() => {
    if (currentView === "dashboard") {
      fetchExams();
    }
  }, [currentView, fetchExams]);

  // Handle Delete Confirmation
  const confirmDeleteExam = (examId) => {
    setConfirmation({
      isOpen: true,
      type: "delete-exam",
      id: examId,
      title: "Delete Exam?",
      message: "Are you sure you want to delete this exam? This will also remove all student submissions for it.",
      isDanger: true,
      confirmText: "Delete"
    });
  };

  const executeConfirmAction = async () => {
    if (confirmation.type === "delete-exam") {
      setIsLoading(true);
      const result = await examAPI.deleteExam(confirmation.id);
      if (result.success) {
        setExams(exams.filter(e => e._id !== confirmation.id));
        setNotification({ isOpen: true, title: "Exam Deleted", message: "The exam has been successfully removed.", type: "success" });
        // NOTE: If real-time notification to students is needed, server.js needs to emit the event inside deleteExam or we emit it here if socket was passed down. Setup in route is already suggested.
      } else {
        setNotification({ isOpen: true, title: "Error", message: result.message, type: "error" });
      }
      setIsLoading(false);
    }
    setConfirmation({ ...confirmation, isOpen: false });
  };

  // Switch to Create mode
  const handleCreateManual = () => {
    setCurrentView("create-manual");
  };

  // Switch to Students list mode
  const handleViewStudents = async (exam) => {
    setSelectedExam(exam);
    setIsLoading(true);
    const result = await examAPI.getExamSubmissions(exam._id);
    if (result.success) {
      setSubmissions(result.data.submissions);
      setCurrentView("students-list");
    } else {
      setNotification({ isOpen: true, title: "Error", message: result.message, type: "error" });
    }
    setIsLoading(false);
  };

  // Switch to Analytics mode
  const handleViewAnalytics = (submission) => {
    setSelectedSubmission(submission);
    setCurrentView("analytics");
  };

  // Dashboard View Implementation
  const renderDashboard = () => (
    <div className="exams-dashboard fade-in">
      <div className="exams-action-cards">
        <div className="exam-card manual-card" onClick={handleCreateManual}>
          <div className="icon-wrapper primary"><Icons.Plus /></div>
          <h3>Create Exam Manually</h3>
          <p>Create a custom test by adding your own questions and choices.</p>
          <button className="create-exam-btn">Create Exam</button>
        </div>
        <div className="exam-card ai-card" onClick={() => setCurrentView("create-ai")}>
          <div className="icon-wrapper secondary"><Icons.Sparkles /></div>
          <h3>Generate Exam Using AI</h3>
          <p>Automatically generate an exam by providing a topic and material.</p>
          <button className="create-exam-btn">Generate Exam</button>
        </div>
      </div>

      <div className="submitted-exams-section">
        <h3>Submitted Exams</h3>
        {isLoading && exams.length === 0 ? (
          <p className="loading-text">Loading exams...</p>
        ) : exams.length === 0 ? (
          <p className="empty-state">No exams created yet. Start by creating one above!</p>
        ) : (
          <div className="exams-table-container">
            <table className="exams-table">
              <thead>
                <tr>
                  <th>Name of Exam</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => {
                  const d = new Date(exam.createdAt);
                  return (
                    <tr key={exam._id}>
                      <td className="fw-500">{exam.examName}</td>
                      <td>{d.toLocaleDateString()}</td>
                      <td>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                      <td>
                        <button className="table-action-btn students-btn" onClick={() => handleViewStudents(exam)}>
                          <Icons.Users /> Students
                        </button>
                      </td>
                      <td>
                        <button className="table-action-btn delete-btn" onClick={() => confirmDeleteExam(exam._id)}>
                          <Icons.Trash /> Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="teacher-exams-container">
      {currentView === "dashboard" && renderDashboard()}
      {currentView === "create-ai" && <CreateAIExamForm classroom={classroom} onBack={() => setCurrentView("dashboard")} onGenerated={(data) => {
        setAiInitialData(data);
        setCurrentView("create-manual");
      }} />}
      {currentView === "create-manual" && <CreateExamForm classroom={classroom} teacherName={teacherName} initialData={aiInitialData} onBack={() => {
        setAiInitialData(null);
        setCurrentView("dashboard");
      }} onCreated={() => {
        setAiInitialData(null);
        setNotification({ isOpen: true, title: "Exam Created", message: "Your new exam has been generated and saved to the database successfully.", type: "success" });
        setCurrentView("dashboard");
      }} />}
      {currentView === "students-list" && <StudentsList exam={selectedExam} submissions={submissions} onBack={() => setCurrentView("dashboard")} onViewAnalytics={handleViewAnalytics} />}
      {currentView === "analytics" && <StudentAnalytics submission={selectedSubmission} exam={selectedExam} onBack={() => setCurrentView("students-list")} />}

      <NotificationModal isOpen={notification.isOpen} onClose={() => setNotification({ ...notification, isOpen: false })} title={notification.title} message={notification.message} type={notification.type} />
      <ConfirmationModal isOpen={confirmation.isOpen} onClose={() => setConfirmation({ ...confirmation, isOpen: false })} onConfirm={executeConfirmAction} title={confirmation.title} message={confirmation.message} isDanger={confirmation.isDanger} confirmText={confirmation.confirmText} />
    </div>
  );
};

// ==========================================
// SUB-components
// ==========================================

const CreateAIExamForm = ({ classroom, onBack, onGenerated }) => {
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState(classroom.subject || "");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [file, setFile] = useState(null);
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!file && !topic) {
      alert("Please upload material or provide a topic.");
      return;
    }
    
    setIsGenerating(true);
    
    const formData = new FormData();
    formData.append('numQuestions', numQuestions);
    formData.append('difficulty', difficulty);
    if (topic) formData.append('topic', topic);
    if (file) formData.append('material', file);

    const result = await examAPI.generateExamAI(formData);
    setIsGenerating(false);

    if (result.success && result.data?.questions) {
      onGenerated({
        examName,
        subject,
        questions: result.data.questions,
        examType: "ai"
      });
    } else {
      alert(result.message || "Failed to generate exam");
    }
  };

  return (
    <div className="create-exam-form fade-in">
      <div className="form-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Generate Exam Using AI <Icons.Sparkles /></h2>
      </div>
      
      <form onSubmit={handleGenerate} className="form-card-dashboard">
        <div className="form-row">
          <div className="form-group flex-1">
            <label>Exam Name</label>
            <input type="text" className="form-input" value={examName} onChange={e => setExamName(e.target.value)} required placeholder="e.g. Midterm Test 1" />
          </div>
          <div className="form-group flex-1">
            <label>Subject</label>
            <input type="text" className="form-input" value={subject} onChange={e => setSubject(e.target.value)} required placeholder="e.g. Mathematics" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label>Number of Questions</label>
            <input type="number" min="1" max="50" className="form-input" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} required />
          </div>
          <div className="form-group flex-1" ref={dropdownRef} style={{ position: 'relative' }}>
            <label>Difficulty</label>
            <div 
              className="form-input" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#f8fafc', color: '#334155', userSelect: 'none' }}
            >
              <span>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'none', fill: '#64748b' }}>
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </div>
            {isDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden'
              }}>
                {['Easy', 'Medium', 'Hard'].map(opt => (
                  <div 
                    key={opt}
                    onClick={() => { setDifficulty(opt.toLowerCase()); setIsDropdownOpen(false); }}
                    style={{
                      padding: '10px 15px', cursor: 'pointer', transition: 'background 0.2s',
                      background: difficulty === opt.toLowerCase() ? '#e0f2fe' : 'transparent',
                      color: difficulty === opt.toLowerCase() ? '#0284c7' : '#334155',
                      fontWeight: difficulty === opt.toLowerCase() ? '600' : '400',
                      borderBottom: opt !== 'Hard' ? '1px solid #f1f5f9' : 'none'
                    }}
                    onMouseEnter={(e) => { if (difficulty !== opt.toLowerCase()) e.target.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { if (difficulty !== opt.toLowerCase()) e.target.style.background = 'transparent'; }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Material Upload (PDF, DOCX, TXT)</label>
          <input type="file" className="form-input" accept=".pdf,.txt,.docx" onChange={e => setFile(e.target.files[0])} />
          <small className="help-text">Upload course material. The AI will strictly use this to generate questions.</small>
        </div>

        <div className="form-group">
          <label>Or describe the topic</label>
          <textarea className="form-input" rows="3" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Basic rules of Algebra..."></textarea>
        </div>

        <div className="form-actions-footer" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="submit-exam-btn" disabled={isGenerating}>
            {isGenerating ? "Generating Magic..." : "Generate AI Exam"}
          </button>
        </div>
      </form>
    </div>
  );
};

const CreateExamForm = ({ classroom, teacherName, onBack, onCreated, initialData }) => {
  const [examName, setExamName] = useState(initialData?.examName || "");
  const [subject, setSubject] = useState(initialData?.subject || classroom.subject || "");
  const [questions, setQuestions] = useState(initialData?.questions || [
    { questionText: "", options: { a: "", b: "", c: "", d: "" }, correctAnswer: "a" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Auto-resize all textareas when questions array is populated or changes
    const timeoutId = setTimeout(() => {
      const textareas = document.querySelectorAll('.questions-container textarea');
      textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      });
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [questions]);

  const handleAddQuestion = () => {
    setQuestions([...questions, { questionText: "", options: { a: "", b: "", c: "", d: "" }, correctAnswer: "a" }]);
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, optKey, value) => {
    const updated = [...questions];
    updated[qIndex].options[optKey] = value;
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = {
      classroomId: classroom._id,
      teacherName,
      examName,
      subject,
      questions,
      examType: initialData?.examType || "manual"
    };

    const result = await examAPI.createExam(payload);
    setIsSubmitting(false);

    if (result.success) {
      onCreated();
    } else {
      alert(result.message || "Failed to create exam");
    }
  };

  return (
    <div className="create-exam-form fade-in">
      <div className="form-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Create Exam Manually</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="form-card-dashboard">
        <div className="form-row">
          <div className="form-group flex-1">
            <label>Exam Name</label>
            <input type="text" className="form-input" value={examName} onChange={e => setExamName(e.target.value)} required placeholder="e.g. Midterm Test 1" />
          </div>
          <div className="form-group flex-1">
            <label>Subject</label>
            <input type="text" className="form-input" value={subject} onChange={e => setSubject(e.target.value)} required placeholder="e.g. Mathematics" />
          </div>
        </div>

        <div className="questions-container">
          {questions.map((q, idx) => (
            <div key={idx} className="question-block">
              <div className="question-header">
                <h4>Question {idx + 1}</h4>
                {questions.length > 1 && (
                  <button type="button" className="remove-q-btn" onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="form-group">
                <textarea
                  className="form-input question-input"
                  value={q.questionText}
                  onChange={e => { handleQuestionChange(idx, 'questionText', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                  placeholder="Type your question here..."
                  rows={2}
                  required
                  style={{ resize: 'none', overflow: 'hidden', lineHeight: '1.5' }}
                />
              </div>
              <div className="options-grid">
                {['a', 'b', 'c', 'd'].map(opt => (
                  <div className="option-input-group" key={opt}>
                    <span className="opt-label">Option {opt.toUpperCase()}</span>
                    <textarea
                      className="form-input"
                      value={q.options[opt]}
                      onChange={e => { handleOptionChange(idx, opt, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      placeholder={`Value for option ${opt}`}
                      rows={1}
                      required
                      style={{ resize: 'none', overflow: 'hidden', lineHeight: '1.5', minHeight: '42px' }}
                    />
                  </div>
                ))}
              </div>
              <div className="form-group correct-answer-group">
                <label>Select Correct Answer:</label>
                <div className="correct-answer-chips">
                  {['a', 'b', 'c', 'd'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`correct-chip ${q.correctAnswer === opt ? 'active' : ''}`}
                      onClick={() => handleQuestionChange(idx, 'correctAnswer', opt)}
                    >
                      Option {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
                <small className="help-text">Select the correct option to enable automatic checking and analytics.</small>
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions-footer">
          <button type="button" className="add-question-btn" onClick={handleAddQuestion}>
            + Add Question
          </button>
          <button type="submit" className="submit-exam-btn" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Exam"}
          </button>
        </div>
      </form>
    </div>
  );
};

const StudentsList = ({ exam, submissions, onBack, onViewAnalytics }) => {
  return (
    <div className="students-list-view fade-in">
      <div className="form-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <h2>Submissions for "{exam.examName}"</h2>
          <p className="subtitle">View how students performed in this exam.</p>
        </div>
      </div>

      <div className="exams-table-container analytics-expanded-card">
        {submissions.length === 0 ? (
          <p className="empty-state">No student has completed this exam yet.</p>
        ) : (
          <table className="exams-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Date</th>
                <th>Submitted At</th>
                <th>Marks</th>
                <th>Analytics</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => {
                const submitTime = sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
                return (
                <tr key={sub._id}>
                  <td className="fw-500">{sub.studentName}</td>
                  <td>{sub.rollNumber}</td>
                  <td>{sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A'}</td>
                  <td>{submitTime}</td>
                  <td>{sub.correctCount} / {sub.totalQuestions}</td>
                  <td>
                    <button className="table-action-btn analytics-btn" onClick={() => onViewAnalytics(sub)}>
                      <Icons.Analytics /> Analytics
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const StudentAnalytics = ({ submission, exam, onBack }) => {
  // SVG Circular progress chart variables
  const total = submission.totalQuestions;
  
  const correctPercent = (submission.correctCount / total) * 100 || 0;
  
  // Actually we can do a pie chart with conic gradient natively via css, it's easier and cleaner.
  const chartStyle = {
    background: `conic-gradient(#22c55e 0% ${correctPercent}%, #ef4444 ${correctPercent}% 100%)`
  };

  return (
    <div className="student-analytics-view fade-in">
      <div className="form-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Performance Analytics: {submission.studentName} (ID: {submission.rollNumber})</h2>
      </div>

      <div className="analytics-summary-cards">
        <div className="counters-section">
          <div className="counter-box total analytics-expanded-card">
            <h3>Total Questions</h3>
            <span className="count">{submission.totalQuestions}</span>
          </div>
          <div className="counter-box correct analytics-expanded-card">
            <h3>Correct Answers</h3>
            <span className="count">{submission.correctCount}</span>
          </div>
          <div className="counter-box wrong analytics-expanded-card">
            <h3>Wrong Answers</h3>
            <span className="count">{submission.wrongCount}</span>
          </div>
        </div>

        <div className="chart-section analytics-expanded-card">
          <h3>Accuracy Breakdown</h3>
          <div className="pie-chart-container">
            <div className="pie-chart" style={chartStyle}></div>
            <div className="pie-legend">
              <div className="legend-item"><span className="dot dot-correct"></span> Correct ({submission.correctCount})</div>
              <div className="legend-item"><span className="dot dot-wrong"></span> Wrong ({submission.wrongCount})</div>
            </div>
          </div>
        </div>
      </div>

      <div className="detailed-answers analytics-expanded-card">
        <h3>Question Breakdown</h3>
        <div className="answers-list">
          {submission.answers.map((ans, idx) => {
            // Find the full question text and options from exam
            const questionData = exam.questions.find(q => q._id === ans.questionId);
            if (!questionData) return null; // Safe fallback

            const isCorrect = ans.isCorrect;
            
            return (
              <div key={idx} className={`answer-card ${isCorrect ? 'answer-correct' : 'answer-wrong'}`}>
                <div className="q-header">
                  <h4>Q{idx + 1}: {questionData.questionText}</h4>
                  <div className="status-icon">
                    {isCorrect ? <Icons.Check /> : <Icons.X />}
                  </div>
                </div>
                
                <div className="selected-option-visual">
                  Student's selected option: <strong>{ans.selectedOption ? ans.selectedOption.toUpperCase() : "None"}</strong> {ans.selectedOption ? `(${questionData.options[ans.selectedOption]})` : ""}
                </div>

                {!isCorrect && (
                  <div className="correct-answer-visual">
                    Correct Answer: <strong>{questionData.correctAnswer.toUpperCase()}</strong> ({questionData.options[questionData.correctAnswer]})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeacherExams;
