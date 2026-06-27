from fastapi import FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import sqlite3
import os

app = FastAPI(title="Modern Task Manager API", version="1.0.0")

# Enable CORS for local development testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "tasks.db"

# Initialize DB
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'Medium',
            due_date TEXT,
            status TEXT DEFAULT 'To Do'
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Pydantic Schemas
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    priority: str = Field(default="Medium")
    due_date: Optional[str] = None
    status: str = Field(default="To Do")

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None

class Task(TaskBase):
    id: int

# Helpers
def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# API Endpoints

# 1. READ ALL TASKS
@app.get("/api/tasks", response_model=List[Task])
def read_tasks():
    conn = get_db_connection()
    try:
        tasks = conn.execute("SELECT * FROM tasks").fetchall()
        return [dict(t) for t in tasks]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 2. CREATE A TASK
@app.post("/api/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO tasks (title, description, priority, due_date, status) VALUES (?, ?, ?, ?, ?)",
            (task.title, task.description, task.priority, task.due_date, task.status)
        )
        task_id = cursor.lastrowid
        conn.commit()
        
        db_task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(db_task)
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 3. UPDATE A TASK
@app.put("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, task: TaskUpdate):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        db_task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not db_task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        updates = []
        params = []
        task_dict = task.dict(exclude_unset=True)
        
        for key, value in task_dict.items():
            updates.append(f"{key} = ?")
            params.append(value)
            
        if updates:
            params.append(task_id)
            cursor.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", tuple(params))
            conn.commit()
            
        updated_task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(updated_task)
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# 4. DELETE A TASK
@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        db_task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not db_task:
            raise HTTPException(status_code=404, detail="Task not found")
            
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Serve Frontend
@app.get("/")
def read_root():
    static_file_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if os.path.exists(static_file_path):
        return FileResponse(static_file_path)
    return {"message": "Backend running. Static files folder 'static' not populated yet."}

# Mount static directory for JS and CSS files
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")
