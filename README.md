<div align="center">
  <h1>🚀 AI Education Pilot</h1>
  <p><strong>Empowering Education Through Artificial Intelligence</strong></p>

## 🌟 About The Project

AI Education Pilot is a comprehensive educational technology platform designed to integrate artificial intelligence into classroom learning. The platform empowers educators with intelligent tools for assignment creation, automated grading, and student progress tracking while providing students with personalized, AI-assisted learning experiences.

### ✨ Key Features

- **🤖 AI-Powered Assignment Generation** - Create diverse, customized assignments using advanced AI models
- **📊 Intelligent Grading System** - Automated assessment with human oversight capabilities
- **📈 Real-time Analytics** - Comprehensive tracking of student progress and engagement
- **🔄 RAG Integration** - Retrieval-Augmented Generation for enhanced educational content
- **👥 Multi-Role Dashboard** - Tailored experiences for teachers, students, and administrators
- **🎯 Personalized Learning** - AI-driven personalized learning paths and recommendations
- **🔐 Secure Authentication** - JWT-based authentication with role-based access control
- **📱 Responsive Design** - Modern, mobile-friendly interface built with Next.js

## 🏗️ Built With

### Backend

- **[FastAPI](https://fastapi.tiangolo.com/)** - Modern, fast web framework for building APIs
- **[LlamaIndex](https://www.llamaindex.ai/)** - Data framework for LLM applications
- **[OpenAI](https://openai.com/)** - GPT models for AI-powered features
- **[SQLAlchemy](https://www.sqlalchemy.org/)** - Python SQL toolkit and ORM
- **[PostgreSQL](https://www.postgresql.org/)** - Advanced relational database
- **[JWT](https://jwt.io/)** - JSON Web Tokens for secure authentication

### Frontend

- **[Next.js](https://nextjs.org/)** - React framework for production
- **[React](https://reactjs.org/)** - Frontend JavaScript library
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Radix UI](https://www.radix-ui.com/)** - Low-level UI primitives
- **[Recharts](https://recharts.org/)** - Composable charting library

### Database Architecture

Our PostgreSQL database is designed for scalability and educational workflows:

**🔗 [Interactive Database Diagram](https://dbdiagram.io/d/68b01146777b52b76cf1efaa)**

<div align="center">
  <a href="https://dbdiagram.io/d/68b01146777b52b76cf1efaa">
    <img src="https://dbdiagram.io/d/68b01146777b52b76cf1efaa.png" alt="Database Schema Diagram" width="600" />
  </a>
</div>

**Core Tables:**

- **Users** - Students, teachers, administrators with role-based access
- **Modules** - Courses and learning modules with access codes
- **Documents** - Educational content (PDFs, PowerPoints, Word docs)
- **Questions** - AI-generated questions from documents
- **Student Answers** - Response tracking with multiple attempts
- **AI Feedback** - Intelligent grading and personalized feedback

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18.18 or higher — required by Next.js 15)
- **Python** (3.13 recommended — matches CI and production; 3.10+ also works)
- **Git**
- **OpenAI API Key** (for AI features)
- **PostgreSQL database with the [pgvector](https://github.com/pgvector/pgvector) extension** (e.g. [Supabase](https://supabase.com/))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/All-Pilot-Modules/aipilot.git
   cd aipilot
   ```
2. **Set up the Backend**

   ```bash
   cd Backend
   ./scripts/setup.sh
   # Creates a venv, installs dependencies, copies .env.example -> .env,
   # creates local storage dirs, and runs DB migrations once .env is filled in.

   # Fill in OPENAI_API_KEY, DATABASE_URL, JWT_SECRET (and SUPABASE_* for
   # file uploads) in .env, then:
   source venv/bin/activate
   alembic upgrade head        # if .env wasn't ready the first time setup.sh ran
   uvicorn main:app --reload --port 8000
   ```
3. **Set up the Frontend**

   ```bash
   cd Frontend
   npm install
   # Create .env.local with the variables listed below (no .env.example yet)
   npm run dev
   ```
4. **Access the Application**

   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`

### Environment Variables

#### Backend (.env)

```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

See `Backend/.env.example` for the full list (Supabase storage, email, RAG config, etc.).

#### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📖 Usage

### For Teachers

- Create AI-powered assignments with customizable difficulty levels
- Manage student rosters and organize classes
- Review and grade submissions with AI assistance
- Track student progress with detailed analytics
- Access comprehensive reporting tools

### For Students

- Submit assignments through an intuitive interface
- Access personalized learning resources
- Track academic progress and achievements
- Receive AI-powered feedback and recommendations
- Collaborate with peers on group projects

### For Administrators

- Monitor platform usage and performance
- Manage user accounts and permissions
- Configure AI model settings and parameters
- Access institution-wide analytics and reports

## 🛣️ Roadmap

- [X] Core platform development
- [X] AI-powered assignment generation
- [X] User authentication and role management
- [ ] Mobile application
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Integration with popular LMS platforms
- [ ] Advanced AI tutoring features

See the [open issues](https://github.com/All-Pilot-Modules/aipilot/issues) for a full list of proposed features and known issues.

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Contact

**Project Maintainer:** [Yubraj Khatri](https://github.com/Yubraj977)

**Project Link:** [https://github.com/All-Pilot-Modules/aipilot](https://github.com/All-Pilot-Modules/aipilot)

---

<div align="center">
  <p><strong>Made with ❤️ for the education community</strong></p>
  <p><em>Transforming education through the power of artificial intelligence</em></p>
</div>
