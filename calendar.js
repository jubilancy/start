let currentDate = new Date();

function generateCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Update header
  const monthName = new Date(year, month).toLocaleString('default', { 
    month: 'long', 
    year: 'numeric' 
  });
  document.getElementById('month-year').textContent = monthName;
  
  // Clear previous calendar
  const calendarBody = document.getElementById('calendar').querySelector('tbody');
  if (calendarBody) calendarBody.remove();
  
  // Create new body
  const tbody = document.createElement('tbody');
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  // Add weekday headers
  const headerRow = document.createElement('tr');
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const th = document.createElement('th');
    th.textContent = day;
    headerRow.appendChild(th);
  });
  document.getElementById('calendar').appendChild(headerRow);
  
  // Build calendar grid
  let row = document.createElement('tr');
  
  // Previous month's days
  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement('td');
    cell.textContent = daysInPrevMonth - i;
    cell.classList.add('other-month');
    row.appendChild(cell);
  }
  
  // Current month's days
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    if (row.children.length === 7) {
      tbody.appendChild(row);
      row = document.createElement('tr');
    }
    
    const cell = document.createElement('td');
    cell.textContent = day;
    
    // Highlight today
    if (year === today.getFullYear() && 
        month === today.getMonth() && 
        day === today.getDate()) {
      cell.classList.add('today');
    }
    
    row.appendChild(cell);
  }
  
  // Fill remaining cells with next month's days
  let nextDay = 1;
  while (row.children.length < 7) {
    const cell = document.createElement('td');
    cell.textContent = nextDay;
    cell.classList.add('other-month');
    row.appendChild(cell);
    nextDay++;
  }
  
  tbody.appendChild(row);
  document.getElementById('calendar').appendChild(tbody);
}

function updateCalendar() {
  generateCalendar(currentDate);
}

// Navigation handlers
document.addEventListener('DOMContentLoaded', function() {
  generateCalendar(currentDate);
  
  document.getElementById('prevMonth').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar(currentDate);
  });
  
  document.getElementById('nextMonth').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar(currentDate);
  });
});
