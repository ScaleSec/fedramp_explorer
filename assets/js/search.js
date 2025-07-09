document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let fuse;

    fetch(`/search.json?t=${new Date().getTime()}`)
        .then(response => response.json())
        .then(data => {
            const options = {
                keys: ['title', 'content', 'id'],
                includeScore: true,
                threshold: 0.1, // Make search much more permissive
                distance: 1000,   // Increase distance for matching
                ignoreLocation: true,
            };
            fuse = new Fuse(data, options);
        });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value;
        if (query.length < 3) {
            searchResults.innerHTML = '';
            return;
        }

        const results = fuse.search(query);
        console.log("Search Results:", results); // Add console log for debugging
        searchResults.innerHTML = '';

        results.slice(0, 10).forEach(result => {
            const li = document.createElement('li');
            li.classList.add('p-2', 'hover:bg-gray-200', 'cursor-pointer');
            const a = document.createElement('a');
            a.href = result.item.url;
            a.textContent = `${result.item.id.toUpperCase()}: ${result.item.title}`;
            a.classList.add('block'); // Make the entire area clickable
            li.appendChild(a);
            searchResults.appendChild(li);
        });
    });

    // Hide results when clicking outside
    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target)) {
            searchResults.innerHTML = '';
        }
    });

    // Accordion for control families
    const accordionHeaders = document.querySelectorAll('[data-family]');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', (event) => {
            const clickedFamily = header.dataset.family;
            
            // Close all other families
            accordionHeaders.forEach(otherHeader => {
                const otherFamily = otherHeader.dataset.family;
                if (otherFamily !== clickedFamily) {
                    const otherControlsList = document.querySelector(`[data-controls-for="${otherFamily}"]`);
                    const otherIcon = otherHeader.querySelector('svg');
                    if (otherControlsList && !otherControlsList.classList.contains('hidden')) {
                        otherControlsList.classList.add('hidden');
                        otherIcon.classList.remove('rotate-90');
                    }
                }
            });

            // Toggle the clicked family
            const controlsList = document.querySelector(`[data-controls-for="${clickedFamily}"]`);
            const icon = header.querySelector('svg');

            if (controlsList) {
                controlsList.classList.toggle('hidden');
                icon.classList.toggle('rotate-90');
            }
        });
    });

    // Highlight active control and keep its family open
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('#control-family-accordion a');
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.parentElement.classList.add('active-control');
            const family = link.closest('ul').dataset.controlsFor;
            const header = document.querySelector(`[data-family="${family}"]`);
            const controlsList = document.querySelector(`[data-controls-for="${family}"]`);
            const icon = header.querySelector('svg');

            if (controlsList) {
                controlsList.classList.remove('hidden');
                icon.classList.add('rotate-90');
            }
        }
    });
});
