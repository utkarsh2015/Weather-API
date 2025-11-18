// ---- Utility helpers ----
const el = (id) => document.getElementById(id);

// Save recent searches (simple localStorage cache)
function saveRecent(name) {
  if (!name) return;
  let arr = JSON.parse(localStorage.getItem('recent-weather') || '[]');
  arr = [name, ...arr.filter(x => x.toLowerCase() !== name.toLowerCase())].slice(0, 6);
  localStorage.setItem('recent-weather', JSON.stringify(arr));
  renderRecent();
}

function renderRecent() {
  const list = el('recent');
  list.innerHTML = '';
  const arr = JSON.parse(localStorage.getItem('recent-weather') || '[]');
  if (arr.length === 0) {
    list.innerHTML = '<li class="small">No recent searches</li>';
    return;
  }
  arr.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.title = 'Click to search ' + item;
    li.addEventListener('click', () => { el('q').value = item; doSearch(); });
    list.appendChild(li);
  });
}

// Display small error
function showError(msg) {
  const e = el('error');
  e.style.display = 'block';
  e.textContent = msg;
}

function clearError() {
  const e = el('error');
  e.style.display = 'none';
  e.textContent = '';
}

// Render weather card
function renderWeather(data, placeName) {
  const out = el('output');
  if (!data) {
    out.innerHTML = '<p class="small">No data available.</p>';
    return;
  }

  const cw = data.current_weather || null;
  const timezone = data.timezone || 'UTC';

  out.innerHTML = `
    <div class="current">
      <div>
        <div class="temp">${cw ? Math.round(cw.temperature) + '°C' : '—'}</div>
        <div class="meta">${placeName} · ${timezone}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div class="small">Wind: ${cw ? cw.windspeed + ' km/h' : '—'}</div>
        <div class="small">Wind dir: ${cw ? cw.winddirection + '°' : '—'}</div>
        <div class="small">As of: ${cw ? new Date(cw.time).toLocaleString() : '—'}</div>
      </div>
    </div>

    <section style="margin-top:12px">
      <div class="small">Raw response (trimmed)</div>
      <pre style="white-space:pre-wrap;background:rgba(255,255,255,0.02);padding:10px;border-radius:8px;overflow:auto;max-height:200px">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
    </section>
  `;
}

// Basic HTML escape
function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// ---- API calls ----
// 1) Geocoding by city name
async function geocodeCity(name) {
  if (!name) throw new Error('Empty city');
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed: ' + res.status);
  const json = await res.json();
  if (!json.results || json.results.length === 0)
    throw new Error('No location found for "' + name + '"');

  return json.results[0];
}

// 2) Current weather
async function fetchWeather(lat, lon, timezone = 'auto') {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=${encodeURIComponent(timezone)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed: ' + res.status);
  return await res.json();
}

// Combined flow
async function doSearch() {
  clearError();
  const q = el('q').value.trim();
  if (!q) {
    showError('Please enter a city name.');
    return;
  }

  el('searchBtn').disabled = true;
  el('searchBtn').textContent = 'Searching...';

  try {
    const place = await geocodeCity(q);
    saveRecent(place.name + (place.country ? ', ' + place.country : ''));

    const weather = await fetchWeather(place.latitude, place.longitude, place.timezone || 'auto');
    renderWeather(
      weather,
      place.name +
      (place.admin1 ? ', ' + place.admin1 : '') +
      (place.country ? ', ' + place.country : '')
    );
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
    el('output').innerHTML = '<p class="small">No results.</p>';
  } finally {
    el('searchBtn').disabled = false;
    el('searchBtn').textContent = 'Search';
  }
}

// Use device geolocation
async function useMyLocation() {
  clearError();
  if (!navigator.geolocation) {
    showError('Geolocation not supported by your browser.');
    return;
  }

  el('locBtn').disabled = true;
  el('locBtn').textContent = 'Locating...';

  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        maximumAge: 600000,
        timeout: 15000
      })
    );

    const lat = pos.coords.latitude,
      lon = pos.coords.longitude;

    saveRecent('My Location');
    const weather = await fetchWeather(lat, lon);
    renderWeather(weather, `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`);
  } catch (err) {
    console.error(err);
    showError('Location error: ' + (err.message || err));
  } finally {
    el('locBtn').disabled = false;
    el('locBtn').textContent = 'Use my location';
  }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  renderRecent();
  el('searchBtn').addEventListener('click', doSearch);
  el('q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  el('locBtn').addEventListener('click', useMyLocation);
});
