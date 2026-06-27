// Frontend Task Manager Logic
const API_URL = '/api/tasks';
let tasks = [];

// DOM Elements
const taskGrid = document.getElementById('task-grid');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');

// Dashboard Stats
const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statCompleted = document.getElementById('stat-completed');

// Modal Elements
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const taskIdInput = document.getElementById('task-id');
const formTitle = document.getElementById('form-title');
const formDescription = document.getElementById('form-description');
const formPriority = document.getElementById('form-priority');
const formStatus = document.getElementById('form-status');
const formDueDate = document.getElementById('form-due-date');

// Buttons
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
btnOpenAddModal.addEventListener('click', () => openModal());
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);
taskForm.addEventListener('submit', handleFormSubmit);
searchInput.addEventListener('input', renderTasks);
filterStatus.addEventListener('change', renderTasks);
filterPriority.addEventListener('change', renderTasks);

// Initial application load
function initApp() {
    fetchTasks();
}

// Fetch all tasks from FastAPI Backend
async function fetchTasks() {
    showLoading();
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        tasks = await response.json();
        updateStats();
        renderTasks();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        taskGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>
                <h3>Failed to load tasks</h3>
                <p>Please check if the FastAPI server is running correctly.</p>
                <button class="btn btn-secondary" onclick="fetchTasks()" style="margin-top: 1rem;">
                    <i class="fa-solid fa-rotate"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Update stats on top dashboard
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.filter(t => t.status === 'In Progress').length;

    statTotal.textContent = total;
    statPending.textContent = pending;
    statCompleted.textContent = completed;
}

// Show animated spinner
function showLoading() {
    taskGrid.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Fetching your tasks from the backend...</p>
        </div>
    `;
}

// Render task list with filtering and search
function renderTasks() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const statusVal = filterStatus.value;
    const priorityVal = filterPriority.value;

    const filtered = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery) || 
                              (task.description && task.description.toLowerCase().includes(searchQuery));
        const matchesStatus = statusVal === 'All' || task.status === statusVal;
        const matchesPriority = priorityVal === 'All' || task.priority === priorityVal;
        
        return matchesSearch && matchesStatus && matchesPriority;
    });

    if (filtered.length === 0) {
        taskGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <h3>No tasks found</h3>
                <p>Try resetting filters or create a new task to get started.</p>
            </div>
        `;
        return;
    }

    taskGrid.innerHTML = '';
    filtered.forEach(task => {
        const card = createTaskCard(task);
        taskGrid.appendChild(card);
    });
}

// Helper to create HTML elements for task card
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.status === 'Completed' ? 'completed' : ''}`;
    card.setAttribute('data-id', task.id);

    // Class name mappings
    let priorityClass = 'low';
    if (task.priority === 'High') priorityClass = 'high';
    if (task.priority === 'Medium') priorityClass = 'medium';

    let statusClass = 'badge-todo';
    if (task.status === 'In Progress') statusClass = 'badge-progress';
    if (task.status === 'Completed') statusClass = 'badge-completed';

    // Due date display
    let dueDateHTML = '';
    if (task.due_date) {
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = task.due_date < today && task.status !== 'Completed';
        dueDateHTML = `
            <div class="due-info ${isOverdue ? 'overdue' : ''}">
                <i class="fa-regular fa-calendar-days"></i>
                <span>${task.due_date} ${isOverdue ? '(Overdue)' : ''}</span>
            </div>
        `;
    } else {
        dueDateHTML = `
            <div class="due-info">
                <i class="fa-regular fa-calendar"></i>
                <span>No due date</span>
            </div>
        `;
    }

    card.innerHTML = `
        <div>
            <div class="task-card-header">
                <span class="badge ${statusClass}">${task.status}</span>
                <span class="priority-tag ${priorityClass}">
                    <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> ${task.priority} Priority
                </span>
            </div>
            <h3 class="task-title">${escapeHTML(task.title)}</h3>
            <p class="task-description">${escapeHTML(task.description || 'No description provided.')}</p>
        </div>
        <div class="task-card-footer">
            ${dueDateHTML}
            <div class="task-actions">
                <button class="action-btn btn-complete" title="${task.status === 'Completed' ? 'Mark Incomplete' : 'Mark Completed'}" onclick="toggleTaskStatus(${task.id})">
                    <i class="fa-solid ${task.status === 'Completed' ? 'fa-rotate-left' : 'fa-check'}"></i>
                </button>
                <button class="action-btn btn-edit" title="Edit Task" onclick="editTask(${task.id})">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="action-btn btn-delete" title="Delete Task" onclick="deleteTask(${task.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    return card;
}

// Modal open logic
function openModal(task = null) {
    if (task) {
        modalTitle.textContent = 'Edit Task';
        taskIdInput.value = task.id;
        formTitle.value = task.title;
        formDescription.value = task.description || '';
        formPriority.value = task.priority;
        formStatus.value = task.status;
        formDueDate.value = task.due_date || '';
    } else {
        modalTitle.textContent = 'Create New Task';
        taskForm.reset();
        taskIdInput.value = '';
    }
    taskModal.classList.add('active');
}

// Modal close logic
function closeModal() {
    taskModal.classList.remove('active');
    taskForm.reset();
    taskIdInput.value = '';
}

// Handle Form Submit (Create & Update API call)
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = taskIdInput.value;
    const taskData = {
        title: formTitle.value.trim(),
        description: formDescription.value.trim(),
        priority: formPriority.value,
        status: formStatus.value,
        due_date: formDueDate.value || null
    };

    const isEdit = id !== '';
    const url = isEdit ? `${API_URL}/${id}` : API_URL;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });

        if (!response.ok) throw new Error('Failed to save task');

        const savedTask = await response.json();
        
        if (isEdit) {
            tasks = tasks.map(t => t.id === parseInt(id) ? savedTask : t);
        } else {
            tasks.unshift(savedTask); // Add to the front
        }

        updateStats();
        renderTasks();
        closeModal();
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Failed to save the task. Please try again.');
    }
}

// Trigger state switch for completion
async function toggleTaskStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'Completed' ? 'To Do' : 'Completed';

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update status');

        const updated = await response.json();
        tasks = tasks.map(t => t.id === id ? updated : t);
        updateStats();
        renderTasks();
    } catch (error) {
        console.error('Error toggling status:', error);
        alert('Failed to update task status.');
    }
}

// Edit button click logic
function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        openModal(task);
    }
}

// Delete task from API
async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const card = document.querySelector(`.task-card[data-id="${id}"]`);
    
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete task');

        // Animation: Fade out card in UI before removing
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px)';
            setTimeout(() => {
                tasks = tasks.filter(t => t.id !== id);
                updateStats();
                renderTasks();
            }, 300);
        } else {
            tasks = tasks.filter(t => t.id !== id);
            updateStats();
            renderTasks();
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
    }
}

// Helper to escape HTML tags to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
