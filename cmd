# 1. Activate the Python virtual environment
.\venv\Scripts\Activate.ps1

# 2. Run migrations to build the tables
python manage.py migrate

# 3. Seed the admin, pricing configs, B2B college and students
python seed_db.py

# 4. Start the backend development server
python manage.py runserver


# 1. Navigate to the frontend directory
cd frontend

# 2. Start the Vite React development server
npm run dev


1. Super Admin Portal (BI & Operations)
Username: admin
Password: admin123
2. College Admin Portal (NAAC Audit logs & Credits)
Username: college_admin
Password: admin123
3. B2B Student / Researcher (Submits using college credits)
Username: b2b_student
Password: student123
4. B2C Student / Researcher (Public payments via Razorpay)
Username: student_b2c
Password: student123