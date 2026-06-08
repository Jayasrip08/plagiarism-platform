# Plagiarism Detection Platform - Startup Guide

This guide provides the necessary commands to set up the PostgreSQL database, migrate schemas, seed B2B college records, and run the frontend and backend servers.

---

## Prerequisites
Ensure that a **PostgreSQL** database is running locally with the following credentials (configured in `core/settings.py`):
- **Database Name**: `plagiarism_platform`
- **Username**: `postgres`
- **Password**: `####`
- **Host**: `localhost`
- **Port**: `5432`

---

## 1. Backend Server Setup & Start

Open a terminal at the root of the project (`e:/plagiarism-platform`) and run:

```powershell
# 1. Activate the Python virtual environment
.\venv\Scripts\Activate.ps1

# 2. Apply database schema migrations
python manage.py migrate

# 3. Seed initial admin accounts, college records, and B2B/B2C users
python seed_db.py

# 4. Start the Django development backend server
python manage.py runserver
```
The Django API will be live at: `http://127.0.0.1:8000/`

---

## 2. Frontend Server Setup & Start

Open a second terminal at the root of the project (`e:/plagiarism-platform`) and run:

```powershell
# 1. Navigate to the frontend folder
cd frontend

# 2. Run the Vite development server
npm run dev
```
The React frontend dashboard will be live at: `http://localhost:5173/`

---

## 3. Local Test Accounts
You can bypass login pages using the **Developer Quick Login** panel on the login screen, or sign in manually using:

*   **Super Admin**: `admin` / `admin123`
*   **College Admin**: `college_admin` / `admin123`
*   **B2B Student**: `b2b_student` / `student123`
*   **B2C Student**: `student_b2c` / `student123`
