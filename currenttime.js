// Update greeting based on time of day
function updateTimeOfDay() {
  const hour = new Date().getHours();
  const timeSpan = document.getElementById('time');
  
  if (hour < 12) {
    timeSpan.textContent = 'Morning';
  } else if (hour < 18) {
    timeSpan.textContent = 'Afternoon';
  } else {
    timeSpan.textContent = 'Evening';
  }
}

// Run on page load
updateTimeOfDay();

// Update every minute
setInterval(updateTimeOfDay, 60000);
