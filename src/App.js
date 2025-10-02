import { useState } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const [currentPage, setCurrentPage] = useState('chat'); // 'chat' or 'quiz'
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const quizQuestions = [
    {
      question: "What percentage of migrant workers send money back home to their families?",
      options: ["Less than 25%", "About 50%", "Over 75%", "None"],
      correct: 2
    },
    {
      question: "What is one of the biggest challenges migrant workers face?",
      options: ["Language barriers", "Too much free time", "Excessive pay", "Short work hours"],
      correct: 0
    },
    {
      question: "Migrant workers contribute significantly to the economy of host countries.",
      options: ["True", "False"],
      correct: 0
    },
    {
      question: "What sector employs the most migrant workers globally?",
      options: ["Technology", "Agriculture and Construction", "Entertainment", "Education"],
      correct: 1
    },
    {
      question: "Migrant workers typically have the same legal protections as local workers.",
      options: ["True", "False"],
      correct: 1
    },
    {
      question: "What is a common reason people become migrant workers?",
      options: ["Tourism", "Economic necessity", "Curiosity", "Short commutes"],
      correct: 1
    }
  ];

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const userMessage = {
        id: Date.now(),
        text: inputValue,
        sender: username,
        timestamp: new Date().toLocaleTimeString()
      };

      const aiResponse = {
        id: Date.now() + 1,
        text: Math.random() < 0.5 ? 'Yes' : 'No',
        sender: 'AI Assistant',
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages([...messages, userMessage, aiResponse]);
      setInputValue('');
    }
  };

  const handleSetUsername = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsUsernameSet(true);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    setSelectedAnswer(answerIndex);
  };

  const handleNextQuestion = () => {
    if (selectedAnswer === quizQuestions[currentQuestion].correct) {
      setScore(score + 1);
    }

    if (currentQuestion + 1 < quizQuestions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setQuizCompleted(true);
    }
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setQuizCompleted(false);
    setSelectedAnswer(null);
  };

  if (!isUsernameSet) {
    return (
      <div className="App">
        <div className="username-container">
          <h1>AI Migrant Worker Assistant</h1>
          <p className="subtitle">Fine-tuned AI based on real migrant worker experiences</p>
          <form onSubmit={handleSetUsername}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="username-input"
            />
            <button type="submit" className="username-button">Start Chat</button>
          </form>
        </div>
      </div>
    );
  }

  if (currentPage === 'quiz') {
    const percentage = Math.round((score / quizQuestions.length) * 100);
    const passed = percentage >= 50;

    return (
      <div className="App">
        <div className="quiz-container">
          <div className="quiz-header">
            <h2>Migrant Worker Knowledge Quiz</h2>
            <button onClick={() => setCurrentPage('chat')} className="nav-button">Back to Chat</button>
          </div>
          {!quizCompleted ? (
            <div className="quiz-content">
              <div className="quiz-progress">
                Question {currentQuestion + 1} of {quizQuestions.length}
              </div>
              <h3 className="quiz-question">{quizQuestions[currentQuestion].question}</h3>
              <div className="quiz-options">
                {quizQuestions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    className={`quiz-option ${selectedAnswer === index ? 'selected' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                onClick={handleNextQuestion}
                disabled={selectedAnswer === null}
                className="quiz-submit"
              >
                {currentQuestion + 1 === quizQuestions.length ? 'Finish Quiz' : 'Next Question'}
              </button>
            </div>
          ) : (
            <div className="quiz-results">
              <h2 className={`result-title ${passed ? 'passed' : 'failed'}`}>
                {passed ? 'Passed!' : 'Failed'}
              </h2>
              <p className="result-score">Your Score: {score} / {quizQuestions.length}</p>
              <p className="result-percentage">{percentage}%</p>
              <p className="result-message">
                {passed
                  ? 'Congratulations! You have a good understanding of migrant worker issues.'
                  : 'You need at least 50% to pass. Try again to learn more about migrant workers.'}
              </p>
              <div className="result-buttons">
                <button onClick={restartQuiz} className="quiz-button">Retry Quiz</button>
                <button onClick={() => setCurrentPage('chat')} className="quiz-button">Back to Chat</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="chat-container">
        <div className="chat-header">
          <h2>AI Migrant Worker Assistant</h2>
          <div className="header-right">
            <button onClick={() => setCurrentPage('quiz')} className="nav-button">Take Quiz</button>
            <span className="username-display">Logged in as: {username}</span>
          </div>
        </div>
        <div className="messages-container">
          {messages.length === 0 ? (
            <p className="no-messages">Ask me anything! I'm an AI trained on migrant worker experiences.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === username ? 'own-message' : 'other-message'}`}
              >
                <div className="message-header">
                  <span className="message-sender">{message.sender}</span>
                  <span className="message-time">{message.timestamp}</span>
                </div>
                <div className="message-text">{message.text}</div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="message-input"
          />
          <button type="submit" className="send-button">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;
