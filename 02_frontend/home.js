const ctx = document.getElementById('myChart').getContext('2d');

const myChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Azure', 'Aws', 'React', 'C#', 'Javascript', '.net'],
    datasets: [{
      data: [148, 129, 125, 123, 123, 122],
      borderWidth: 1,
      backgroundColor: [
        '#f87171',
        '#60a5fa',
        '#facc15',
        '#34d399',
        '#c084fc',
        '#fb923c'
      ]
    }]
  },
  options: {
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: false  
      }
    }
  }
});

