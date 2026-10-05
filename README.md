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

- Python 3.13 (matches the backend Docker image and main CI workflow).
- Node.js 22.12+ and npm (the frontend test workflow uses Node 22).
- Git.
- Access to an Infisical project and its `dev` environment, with Universal Auth credentials permitted to read secrets at `/`.
- A provisioned development PostgreSQL database with pgvector and the application schema, plus development Supabase storage.

Use a separate database for development and production. Backend instances sharing a database also share `feedback_jobs` and `worker_lock`; an online worker can process local submissions with different code. Setting `INFISICAL_ENVIRONMENT=dev` selects secrets—it does not create or isolate a database. Ensure the selected secrets actually point to development resources.

### 1. Clone and install backend dependencies

These commands assume macOS/Linux and start from the directory where you want the repository:

```bash
git clone https://github.com/All-Pilot-Modules/aipilot.git
cd aipilot/Backend
python3.13 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
mkdir -p uploads index_store parsed_docs
```

### 2. Create `Backend/.env`

Create this file yourself with the following entries. Fill in the first three values with your Infisical credentials and project ID; do not leave them blank when using Infisical:

```env
INFISICAL_CLIENT_ID=
INFISICAL_CLIENT_SECRET=
INFISICAL_PROJECT_ID=
INFISICAL_ENVIRONMENT=dev
INFISICAL_SITE_URL=https://app.infisical.com
```

Obtain the client ID and client secret for an authorized Infisical machine identity, and the project ID from your project administrator. Keep this file local; never commit credentials or put them in frontend environment files.

The backend reads secrets from the root path `/` of the selected Infisical environment at startup. That environment must provide these variables, which the backend validates:

```env
OPENAI_API_KEY=<development OpenAI API key>
DATABASE_URL=<development PostgreSQL connection URL>
JWT_SECRET=<strong development signing secret>
SUPABASE_URL=<development Supabase project URL>
SUPABASE_SERVICE_KEY=<development Supabase service key>
```

Also configure these as needed:

- `SUPABASE_STORAGE_BUCKET` (default `documents`) and `SUPABASE_USER_BUCKET` (default `user-assets`): provision the buckets used by uploads.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`, and `EMAIL_FROM_NAME`: required for working email delivery/verification flows.
- `FRONTEND_URL=http://localhost:3000`: frontend links and allowed CORS origin.
- `ENV=development`, `LLM_MODEL`, and `EMBED_MODEL`: application environment and model settings.

**Configuration precedence:** successfully fetched Infisical secrets overwrite matching environment/local `.env` values. If Infisical credentials are missing or fetching fails, the code falls back to local configuration; it does not guarantee startup will succeed. Check for the `Infisical: loaded ... secrets from 'dev'` startup message. Restart the backend after changing secrets.

For standalone setup without Infisical, use [Backend/.env.example](Backend/.env.example) and fill in all five required application variables directly, leaving the three Infisical credential/project fields empty.

### 3. Check the database schema

From `Backend`, with the virtual environment active and development secrets configured:

```bash
python -m alembic current
python -m alembic upgrade head
```

Alembic imports the application configuration, so it also loads Infisical secrets. Verify the selected `DATABASE_URL` targets development before running migrations.

**Fresh database limitation:** the initial Alembic revision is an empty baseline. `alembic upgrade head` alone does not create the entire application on an empty database. Have the maintainer provision a compatible development schema first. [Backend/schema.sql](Backend/schema.sql) and the model creation script exist, but they must be reconciled with migration history before use; do not blindly stamp a new database as current or run a fresh-install schema over existing data.

### 4. Start the backend

From `Backend`, choose one command:

```bash
# Normal startup
venv/bin/python main.py

# Or capture request, database, and AI timings for troubleshooting
venv/bin/python main.py --capture-latency
```

Both serve on `http://127.0.0.1:8000`. The capture command prints the log filename under `Backend/tmp/`. Neither command enables automatic reload; restart after code edits. For development with automatic reload, use this instead:

```bash
venv/bin/python -m uvicorn main:app --reload --port 8000
```

The feedback worker starts inside the backend; no separate worker command is required. Look for `is the leader — starting feedback worker`. A `lost leader election` message means another instance owns this database's feedback queue.

### 5. Start the frontend in a second terminal

From the repository root:

```bash
cd Frontend
npm ci
```

Create `Frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000`. Backend API documentation is at `http://localhost:8000/docs`. Keep both terminals running. Frontend `NEXT_PUBLIC_*` values are public browser configuration; never put service keys or Infisical credentials there.

### Verify and troubleshoot

- Confirm backend startup completes without missing-variable or Infisical-fetch errors.
- Open the API documentation and frontend, then test a development module submission.
- Confirm real feedback appears. A `done` job records completion history; older worker versions also used it for fallback results, so status alone is not proof of successful AI feedback.
- Completed jobs remain in `feedback_jobs`; processing does not empty the table.
- If local feedback remains queued, check worker leadership and whether another backend shares the development database.

To summarize a captured latency log, run from `Backend`, replacing the filename with the path printed at startup:

```bash
venv/bin/python scripts/latency_report.py "tmp/aipilot-latency-<timestamp>-<id>.log"
```

See [latency measurement](docs/testing/LATENCY.md), [feedback reliability](docs/testing/FEEDBACK_RELIABILITY.md), and [automated/manual testing instructions](docs/testing/TESTING.md) for detailed checks and known test limitations.

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
