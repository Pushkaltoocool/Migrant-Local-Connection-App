// Application State
const state = {
  messages: [],
  username: '',
  isUsernameSet: false,
  currentPage: 'chat', // 'chat' or 'quiz'
  currentQuestion: 0,
  score: 0,
  quizCompleted: false,
  selectedAnswer: null,
};

// Quiz Questions Data
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

// Helper function to get current time
function getCurrentTime() {
  return new Date().toLocaleTimeString();
}

// Render Username Screen
function renderUsernameScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="username-container">
      <h1>AI Migrant Worker Assistant</h1>
      <p class="subtitle">Fine-tuned AI based on real migrant worker experiences</p>
      <form id="username-form">
        <input
          type="text"
          id="username-input"
          placeholder="Enter your username"
          class="username-input"
        />
        <button type="submit" class="username-button">Start Chat</button>
      </form>
    </div>
  `;

  // Add event listener
  document.getElementById('username-form').addEventListener('submit', handleSetUsername);
}

// Render Chat Screen
function renderChatScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="chat-container">
      <div class="chat-header">
        <h2>AI Migrant Worker Assistant</h2>
        <div class="header-right">
          <button id="quiz-nav-button" class="nav-button">Take Quiz</button>
          <span class="username-display">Logged in as: ${state.username}</span>
        </div>
      </div>
      <div class="messages-container" id="messages-container">
        ${renderMessages()}
      </div>
      <form id="message-form" class="message-form">
        <input
          type="text"
          id="message-input"
          placeholder="Type a message..."
          class="message-input"
        />
        <button type="submit" class="send-button">Send</button>
      </form>
    </div>
  `;

  // Add event listeners
  document.getElementById('message-form').addEventListener('submit', handleSendMessage);
  document.getElementById('quiz-nav-button').addEventListener('click', () => {
    state.currentPage = 'quiz';
    render();
  });
}

// Render Messages
function renderMessages() {
  if (state.messages.length === 0) {
    return '<p class="no-messages">Ask me anything! I\'m an AI trained on migrant worker experiences.</p>';
  }

  return state.messages.map(message => `
    <div class="message ${message.sender === state.username ? 'own-message' : 'other-message'}">
      <div class="message-header">
        <span class="message-sender">${message.sender}</span>
        <span class="message-time">${message.timestamp}</span>
      </div>
      <div class="message-text">${message.text}</div>
    </div>
  `).join('');
}

// Render Quiz Screen
function renderQuizScreen() {
  const app = document.getElementById('app');

  if (state.quizCompleted) {
    const percentage = Math.round((state.score / quizQuestions.length) * 100);
    const passed = percentage >= 50;

    app.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-header">
          <h2>Migrant Worker Knowledge Quiz</h2>
          <button id="back-to-chat" class="nav-button">Back to Chat</button>
        </div>
        <div class="quiz-results">
          <h2 class="result-title ${passed ? 'passed' : 'failed'}">
            ${passed ? 'Passed!' : 'Failed'}
          </h2>
          <p class="result-score">Your Score: ${state.score} / ${quizQuestions.length}</p>
          <p class="result-percentage">${percentage}%</p>
          <p class="result-message">
            ${passed
              ? 'Congratulations! You have a good understanding of migrant worker issues.'
              : 'You need at least 50% to pass. Try again to learn more about migrant workers.'}
          </p>
          <div class="result-buttons">
            <button id="retry-quiz" class="quiz-button">Retry Quiz</button>
            <button id="back-to-chat-results" class="quiz-button">Back to Chat</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-to-chat').addEventListener('click', () => {
      state.currentPage = 'chat';
      render();
    });
    document.getElementById('retry-quiz').addEventListener('click', restartQuiz);
    document.getElementById('back-to-chat-results').addEventListener('click', () => {
      state.currentPage = 'chat';
      render();
    });
  } else {
    const question = quizQuestions[state.currentQuestion];

    app.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-header">
          <h2>Migrant Worker Knowledge Quiz</h2>
          <button id="back-to-chat" class="nav-button">Back to Chat</button>
        </div>
        <div class="quiz-content">
          <div class="quiz-progress">
            Question ${state.currentQuestion + 1} of ${quizQuestions.length}
          </div>
          <h3 class="quiz-question">${question.question}</h3>
          <div class="quiz-options">
            ${question.options.map((option, index) => `
              <button
                class="quiz-option ${state.selectedAnswer === index ? 'selected' : ''}"
                data-index="${index}"
              >
                ${option}
              </button>
            `).join('')}
          </div>
          <button
            id="quiz-submit"
            class="quiz-submit"
            ${state.selectedAnswer === null ? 'disabled' : ''}
          >
            ${state.currentQuestion + 1 === quizQuestions.length ? 'Finish Quiz' : 'Next Question'}
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    document.getElementById('back-to-chat').addEventListener('click', () => {
      state.currentPage = 'chat';
      render();
    });

    document.querySelectorAll('.quiz-option').forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        handleAnswerSelect(index);
      });
    });

    document.getElementById('quiz-submit').addEventListener('click', handleNextQuestion);
  }
}

// Event Handlers
function handleSetUsername(e) {
  e.preventDefault();
  const input = document.getElementById('username-input');
  const username = input.value.trim();

  if (username) {
    state.username = username;
    state.isUsernameSet = true;
    render();
  }
}

function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const inputValue = input.value.trim();

  if (inputValue) {
    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: state.username,
      timestamp: getCurrentTime()
    };

    const aiResponse = {
      id: Date.now() + 1,
      text: Math.random() < 0.5 ? 'Yes' : 'No',
      sender: 'AI Assistant',
      timestamp: getCurrentTime()
    };

    state.messages.push(userMessage, aiResponse);
    input.value = '';

    // Re-render just the messages
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = renderMessages();

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function handleAnswerSelect(answerIndex) {
  state.selectedAnswer = answerIndex;
  render();
}

function handleNextQuestion() {
  if (state.selectedAnswer === quizQuestions[state.currentQuestion].correct) {
    state.score++;
  }

  if (state.currentQuestion + 1 < quizQuestions.length) {
    state.currentQuestion++;
    state.selectedAnswer = null;
  } else {
    state.quizCompleted = true;
  }

  render();
}

function restartQuiz() {
  state.currentQuestion = 0;
  state.score = 0;
  state.quizCompleted = false;
  state.selectedAnswer = null;
  render();
}

// Main Render Function
function render() {
  if (!state.isUsernameSet) {
    renderUsernameScreen();
  } else if (state.currentPage === 'quiz') {
    renderQuizScreen();
  } else {
    renderChatScreen();
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  render();
});
