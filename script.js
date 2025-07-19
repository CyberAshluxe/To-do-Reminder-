    // DOM Elements
    const taskList = document.getElementById("taskList");
    const emptyState = document.getElementById("emptyState");
    const currentDateTime = document.getElementById("currentDateTime");
    const themeToggle = document.getElementById("themeToggle");
    const addReminderBtn = document.getElementById("addReminderBtn");
    const taskReminder = document.getElementById("taskReminder");
    const notificationSound = document.getElementById("notificationSound");
    
    // Initialize tasks from localStorage
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let currentFilter = 'all';
    let darkMode = false;
    let reminderTimeouts = {};

    // Initialize the app
    function init() {
      updateDateTime();
      setInterval(updateDateTime, 1000);
      
      // Check notification permission
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
      
      // Set up event listeners
      taskReminder.addEventListener('change', function() {
        addReminderBtn.style.display = this.value ? 'block' : 'none';
      });
      
      addReminderBtn.addEventListener('click', function() {
        alert(`Reminder set for: ${new Date(taskReminder.value).toLocaleString()}`);
      });
      
      themeToggle.addEventListener('click', toggleDarkMode);
      
      // Load and render tasks
      loadTasks();
      renderTasks();
      updateTaskStats();
      
      // Schedule existing reminders
      tasks.forEach(task => {
        if (!task.completed && task.reminders && task.reminders.length > 0) {
          scheduleReminders(task);
        }
      });
    }

    // Update current date and time display
    function updateDateTime() {
      const now = new Date();
      currentDateTime.textContent = now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Check for overdue tasks every minute
      if (now.getSeconds() === 0) {
        checkOverdueTasks();
      }
    }

    // Toggle dark mode
    function toggleDarkMode() {
      darkMode = !darkMode;
      document.documentElement.classList.toggle('dark', darkMode);
      themeToggle.innerHTML = darkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      localStorage.setItem('darkMode', darkMode);
    }

    // Load dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
      toggleDarkMode();
    }

    // Add a new task
    function addTask() {
      const title = document.getElementById("taskTitle").value.trim();
      const dueDate = document.getElementById("taskDueDate").value;
      const priority = document.getElementById("taskPriority").value;
      const category = document.getElementById("taskCategory").value;
      const description = document.getElementById("taskDescription").value;
      const reminder = document.getElementById("taskReminder").value;

      if (!title) {
        alert("Please enter a task title.");
        return;
      }

      const task = {
        id: Date.now(),
        title,
        description,
        category,
        priority,
        dueDate,
        reminders: reminder ? [reminder] : [],
        createdAt: new Date().toISOString(),
        completed: false
      };

      tasks.push(task);
      saveTasks();
      renderTasks();
      updateTaskStats();
      
      if (reminder) {
        scheduleReminders(task);
      }

      // Clear form
      document.getElementById("taskTitle").value = "";
      document.getElementById("taskDueDate").value = "";
      document.getElementById("taskReminder").value = "";
      document.getElementById("taskDescription").value = "";
      addReminderBtn.style.display = 'none';
    }

    // Render tasks based on current filter and sort
    function renderTasks() {
      taskList.innerHTML = "";
      
      let filteredTasks = [...tasks];
      const sortBy = document.getElementById("sortTasks").value;
      
      // Apply filter
      if (currentFilter === 'active') {
        filteredTasks = filteredTasks.filter(task => !task.completed);
      } else if (currentFilter === 'completed') {
        filteredTasks = filteredTasks.filter(task => task.completed);
      }
      
      // Apply sorting
      filteredTasks.sort((a, b) => {
        if (sortBy === 'priority') {
          const priorityOrder = { high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        } else if (sortBy === 'createdAt') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        } else {
          // Default sort by due date
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }
      });
      
      if (filteredTasks.length === 0) {
        emptyState.style.display = 'block';
        return;
      }
      
      emptyState.style.display = 'none';
      
      filteredTasks.forEach(task => {
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
        const taskElement = document.createElement("div");
        
        taskElement.className = `task-item bg-white border rounded-lg p-4 shadow-sm ${task.priority ? 'priority-' + task.priority : ''} ${task.completed ? 'task-completed' : ''} ${isOverdue ? 'border-l-4 border-danger-600 animate-pulse' : ''}`;
        
        taskElement.innerHTML = `
          <div class="flex justify-between items-start">
            <div class="flex items-start space-x-3 w-full">
              <button onclick="toggleTaskCompletion(${task.id})" class="mt-1 flex-shrink-0">
                <i class="fas fa-${task.completed ? 'check-circle text-success-600' : 'circle text-gray-300'} fa-lg"></i>
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                  <h3 class="task-title text-lg font-medium mb-1 truncate">${task.title}</h3>
                  <span class="text-xs px-2 py-1 rounded-full ${getPriorityBadgeClass(task.priority)}">
                    ${task.priority}
                  </span>
                </div>
                ${task.description ? `<p class="text-gray-600 mb-2">${task.description}</p>` : ''}
                <div class="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  ${task.category ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100">
                    <i class="fas fa-${getCategoryIcon(task.category)} mr-1"></i> ${task.category}
                  </span>` : ''}
                  ${task.dueDate ? `<span class="inline-flex items-center">
                    <i class="far fa-calendar-alt mr-1"></i> ${new Date(task.dueDate).toLocaleString()}
                  </span>` : ''}
                  ${task.reminders && task.reminders.length > 0 ? `<span class="inline-flex items-center">
                    <i class="far fa-bell mr-1"></i> ${task.reminders.length} reminder${task.reminders.length > 1 ? 's' : ''}
                  </span>` : ''}
                </div>
              </div>
            </div>
            <div class="flex space-x-2 ml-2">
              <button onclick="editTask(${task.id})" class="text-gray-500 hover:text-primary-600 p-1">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="deleteTask(${task.id})" class="text-gray-500 hover:text-danger-600 p-1">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;
        
        taskList.appendChild(taskElement);
      });
    }

    // Filter tasks
    function filterTasks(filter) {
      currentFilter = filter;
      
      // Update active state of filter buttons
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-primary-600', 'text-white');
        btn.classList.add('border', 'hover:bg-gray-100');
      });
      
      event.target.classList.add('active', 'bg-primary-600', 'text-white');
      event.target.classList.remove('border', 'hover:bg-gray-100');
      
      renderTasks();
    }

    // Toggle task completion status
    function toggleTaskCompletion(id) {
      tasks = tasks.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
      );
      saveTasks();
      renderTasks();
      updateTaskStats();
      
      // Cancel reminders if task is completed
      if (tasks.find(t => t.id === id).completed) {
        cancelReminders(id);
      }
    }

    // Edit task
    function editTask(id) {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      
      // In a real app, you'd show a modal or form to edit the task
      // For simplicity, we'll just update the title with a prompt
      const newTitle = prompt("Edit task title:", task.title);
      if (newTitle && newTitle.trim() !== "") {
        task.title = newTitle.trim();
        saveTasks();
        renderTasks();
      }
    }

    // Delete task
    function deleteTask(id) {
      if (confirm("Are you sure you want to delete this task?")) {
        tasks = tasks.filter(task => task.id !== id);
        saveTasks();
        renderTasks();
        updateTaskStats();
        cancelReminders(id);
      }
    }

    // Schedule reminders for a task
    function scheduleReminders(task) {
      if (!task.reminders || task.reminders.length === 0) return;
      
      cancelReminders(task.id);
      
      task.reminders.forEach((reminder, index) => {
        const delay = new Date(reminder).getTime() - Date.now();
        
        if (delay > 0) {
          const timeoutId = setTimeout(() => {
            showNotification(task);
          }, delay);
          
          reminderTimeouts[`${task.id}_${index}`] = timeoutId;
        }
      });
    }

    // Cancel all reminders for a task
    function cancelReminders(taskId) {
      Object.keys(reminderTimeouts).forEach(key => {
        if (key.startsWith(taskId + '_')) {
          clearTimeout(reminderTimeouts[key]);
          delete reminderTimeouts[key];
        }
      });
    }

    // Show notification for a task
    function showNotification(task) {
      // Play sound
      notificationSound.play().catch(e => console.log("Audio playback failed:", e));
      
      // Show browser notification
      if (Notification.permission === "granted") {
        new Notification(`⏰ Reminder: ${task.title}`, {
          body: task.description || "No additional details",
          icon: "https://cdn-icons-png.flaticon.com/512/3064/3064197.png"
        });
      } else {
        alert(`Reminder: ${task.title}\n\n${task.description || ""}`);
      }
      
      // Highlight the task in the UI
      const taskElement = document.querySelector(`.task-item[data-id="${task.id}"]`);
      if (taskElement) {
        taskElement.classList.add('animate-pulse');
        setTimeout(() => {
          taskElement.classList.remove('animate-pulse');
        }, 3000);
      }
    }

    // Check for overdue tasks
    function checkOverdueTasks() {
      const now = new Date();
      tasks.forEach(task => {
        if (!task.completed && task.dueDate && new Date(task.dueDate) < now) {
          // Update UI on next render
          renderTasks();
          updateTaskStats();
        }
      });
    }

    // Update task statistics
    function updateTaskStats() {
      const total = tasks.length;
      const active = tasks.filter(t => !t.completed).length;
      const completed = tasks.filter(t => t.completed).length;
      const overdue = tasks.filter(t => 
        !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
      ).length;
      
      document.getElementById("totalTasks").textContent = total;
      document.getElementById("activeTasks").textContent = active;
      document.getElementById("completedTasks").textContent = completed;
      document.getElementById("overdueTasks").textContent = overdue;
    }

    // Save tasks to localStorage
    function saveTasks() {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }

    // Load tasks from localStorage
    function loadTasks() {
      const savedTasks = localStorage.getItem("tasks");
      if (savedTasks) {
        tasks = JSON.parse(savedTasks);
      }
    }

    // Helper function to get priority badge class
    function getPriorityBadgeClass(priority) {
      switch (priority) {
        case 'high': return 'bg-danger-100 text-danger-800';
        case 'medium': return 'bg-yellow-100 text-yellow-800';
        case 'low': return 'bg-success-100 text-success-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    }

    // Helper function to get category icon
    function getCategoryIcon(category) {
      switch (category) {
        case 'work': return 'briefcase';
        case 'personal': return 'user';
        case 'shopping': return 'shopping-cart';
        case 'health': return 'heartbeat';
        default: return 'folder';
      }
    }

    // Initialize the app when DOM is loaded
    document.addEventListener('DOMContentLoaded', init);