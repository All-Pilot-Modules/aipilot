<div align="center">
  <h1>🚀 AI Education Pilot</h1>
  <p><strong>Empowering Education Through Artificial Intelligence</strong></p>
</div>

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

## 🚀 Getting Started

### Prerequisites

- Python 3.13
- Node.js 22.12+ and npm
- Git
- Access to the project's Infisical development secrets

### 1. Clone the repository

```bash
git clone https://github.com/All-Pilot-Modules/aipilot.git
cd aipilot
```

### 2. Configure the backend

Create `Backend/.env` with only these entries:

```env
INFISICAL_CLIENT_ID=
INFISICAL_CLIENT_SECRET=
INFISICAL_PROJECT_ID=
INFISICAL_ENVIRONMENT=dev
INFISICAL_SITE_URL=https://app.infisical.com
```

Fill in the first three values with the credentials provided by your project administrator. The backend pulls the remaining configuration and secrets from Infisical automatically at startup. Do not commit your `.env` file.

### 3. Set up and run the backend

From the repository root:

```bash
cd Backend
bash scripts/setup.sh
venv/bin/python main.py
```

The setup script creates the virtual environment, installs dependencies, and creates local storage folders. With the Infisical-only `.env`, its local `DATABASE_URL` check skips migrations; use the project's already-configured development database supplied through Infisical.

Keep this terminal running. The backend is available at `http://localhost:8000`.

### 4. Run the frontend

Open a second terminal at the repository root:

```bash
cd Frontend
npm ci
npm run dev
```

The frontend defaults to the local backend at `http://localhost:8000`.

Open **http://localhost:3000** to use the application.

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
