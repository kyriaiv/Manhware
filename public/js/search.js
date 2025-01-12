document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('searchInput').value;
    
    fetch(`/api/search?query=${query}`)
        .then(response => response.json())
        .then(data => {
            console.log(data); // Tampilkan hasil pencarian
        })
        .catch(error => {
            console.error('Error:', error);
        });
});