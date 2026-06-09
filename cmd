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


frontend/.env need to be change 

If you want to wipe the entire database completely (including the super admin and all configurations), you can run:

bash
python manage.py flush