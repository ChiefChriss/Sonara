# Sonara 🎵

Sonara is a modern, full-stack, decoupled music platform designed for music discovery, creation, and marketplace interaction. The platform separates a responsive, dynamic frontend from a secure, high-performance backend API.

### 🌐 Live Demo

[sonara.us](https://sonara.us)

---

## 🏗️ Architecture & Deployment

Sonara uses a fully decoupled architecture optimized for cloud deployment via **Railway**:

- **Frontend Client:** Built with **Next.js**, leveraging React components and dynamic routing. Communicates securely with the backend via environment-managed API paths.
- **Backend API Engine:** Powered by **Django**, serving as a secure, scalable RESTful API handling database orchestration, multi-role user authentication, and marketplace operations.
- **Production Infrastructure:** Hosted on **Railway** with automated Git-triggered builds, isolated runtime environments, and a managed PostgreSQL database instance.

```text
┌──────────────────┐    HTTPS Requests    ┌──────────────────┐    Secure Queries    ┌────────────────────┐
│ Railway Hosted   │ ──────────────────> │ Railway Hosted   │ ──────────────────> │ Railway Managed    │
│ Next.js Client   │                     │ Django Engine    │                     │ PostgreSQL Instance│
│                  │ <────────────────── │                  │ <────────────────── │                    │
└──────────────────┘    JSON Responses   └──────────────────┘                     └────────────────────┘
```

---

## 🚀 Features

- **Multi-Sided Marketplace:** Dynamic handling of user roles enabling creation, distribution, and transactional operations.
- **Optimized Audio Delivery:** Structured media management for efficient streaming asset handling without client bottlenecking.
- **Decoupled Security Layer:** Production-ready state management with secure cross-origin resource sharing (CORS) configuration.

---

## 🤖 AI-Accelerated Development

This project was built with heavy AI acceleration and pair-programming methodologies. By integrating generative AI into the workflow, the team was able to:

- Drastically shorten development cycles
- Brainstorm and validate system architectures
- Generate clean boilerplate and configuration code
- Rapidly debug complex cross-framework integration issues between Next.js and Django

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js, React, Tailwind CSS, JavaScript |
| **Backend** | Python, Django, Django REST Framework |
| **Database** | PostgreSQL (managed via Railway) |
| **Hosting & DevOps** | Railway Cloud Platform, Environment Secret Variables |

---

## ⚙️ Local Development

### Prerequisites

- Node.js `v18.x` or higher
- Python `v3.10` or higher

### 1. Environment Variables

Set up `.env` files in both the frontend and backend directories to link the communication layers.

**`/backend/.env`**
```env
DEBUG=True
SECRET_KEY=your_local_secret_key
DATABASE_URL=your_local_or_railway_db_string
ALLOWED_HOSTS=localhost,127.0.0.1
```

**`/frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 👥 Contributors

- **Christopher Ramos** — [@ChiefChriss](https://github.com/ChiefChriss)
- **Easton** — [@EastonCC](https://github.com/EastonCC)
