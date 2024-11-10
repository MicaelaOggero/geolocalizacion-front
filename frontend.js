const ip= 'localhost';

// Inicializar el mapa centrado en una ubicación específica
var map = L.map('map').setView([-31.4233, -62.0810], 18); // Coordenadas iniciales

// Cargar y mostrar los tiles del mapa de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Crear un ícono personalizado para el marcador
var colectivoIcon = L.icon({
    iconUrl: 'img/colectivo.png', // Ruta a tu imagen del ícono
    iconSize: [20, 20], // Tamaño del ícono (ajusta según tus necesidades)
    iconAnchor: [10, 10], // Punto del ícono que corresponderá a la ubicación del marcador
    popupAnchor: [0, -10], // Punto desde el que se abrirá el popup, en relación al ícono
    className:'colectivo-icon'
});

var paradaIcon = L.icon({
    iconUrl: 'img/parada-de-autobus.png', // Ruta a tu imagen del ícono
    iconSize: [40, 40], // Tamaño del ícono (ajusta según tus necesidades)
    iconAnchor: [10, 30], // Punto del ícono que corresponderá a la ubicación del marcador
    popupAnchor: [0, -10], // Punto desde el que se abrirá el popup, en relación al ícono
    className:'parada-icon'
});



// Crear un marcador en la ubicación inicial con el ícono personalizado
var marker = L.marker([-31.4233, -62.0810], { icon: colectivoIcon }).addTo(map);


// Función para obtener coordenadas del backend
async function getCoordinates() {
    try {
        let response = await fetch(`https://geolocalizacion-api-ygyd.onrender.com/coordenadas`); // Cambia a la IP si es necesario
        if (!response.ok) {
            throw new Error('Error en la respuesta de la red: ' + response.statusText);
        }
        let data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al obtener coordenadas:', error);
    }
}

let paradas = []; // Arreglo para almacenar las paradas
let markers = []; // Arreglo para almacenar los marcadores de Leaflet
let horarioMarkers = []; // Arreglo para almacenar los marcadores de horarios


// Función para obtener paradas del backend
async function getParadas() {
    try {
        let response = await fetch(`https://geolocalizacion-api-ygyd.onrender.com/paradas`); // Cambia a la IP si es necesario
        if (!response.ok) {
            throw new Error('Error en la respuesta de la red: ' + response.statusText);
        }
        paradas = await response.json(); // Almacenar las paradas
        mostrarParadas(); // Llamar a la función para mostrarlas en el mapa
    } catch (error) {
        console.error('Error al obtener paradas:', error);
    }
}


// Función para mostrar las paradas en el mapa
function mostrarParadas() {
    paradas.forEach(parada => {
        let marker = L.marker([parada.latitud, parada.longitud], {icon: paradaIcon})
            .addTo(map)
            .bindPopup(parada.nombre + "<br>" + (parada.descripcion || "Sin descripción"));
        markers.push(marker); // Almacenar el marcador en el arreglo
    });
}

// Función para borrar las paradas del mapa
function borrarHorarios() {
    horarioMarkers.forEach(marker => {
        map.removeLayer(marker); // Eliminar cada marcador de horario del mapa
    });
    horarioMarkers = []; // Limpiar el arreglo de marcadores de horarios
}


let horarios = []; // Arreglo para almacenar las paradas
// Función para obtener horarios y mostrarlos en el mapa
async function getHorarios(lineaId) {
    try {
        let response = await fetch(`https://geolocalizacion-api-ygyd.onrender.com/get_horario/${lineaId}`); // Cambia a la IP si es necesario
        if (!response.ok) {
            throw new Error('Error en la respuesta de la red: ' + response.statusText);
        }
        horarios = await response.json(); // Almacenar los horarios
        mostrarHorarios(); // Llamar a la función para mostrarlos en el mapa
    } catch (error) {
        console.error('Error al obtener horarios:', error);
    }
}

// Función para mostrar los horarios en el mapa
function mostrarHorarios() {
    borrarHorarios(); // Limpiar los horarios previos

    horarios.forEach(horario => {
        let popupContent = `Hora de llegada: ${horario.hora_llegada || "Sin horario"}`; 
    
        // Si hay un horario de salida, lo agregamos al contenido del popup
        if (horario.hora_salida) {
            popupContent += `<br>Hora de salida: ${horario.hora_salida}`;
        } 
    
        let marker = L.marker([horario.latitud, horario.longitud], {icon: paradaIcon})
            .addTo(map)
            .bindPopup(popupContent); // Mostrar tanto la hora de llegada como la de salida (si la hay)
    
        horarioMarkers.push(marker); // Almacenar el marcador de horario en el arreglo
    });
    
}
// Función para mover el marcador a las coordenadas obtenidas
async function moveMarker() {
    const coordenadas = await getCoordinates();
    
    if (coordenadas && coordenadas.length > 0) {
        const newLat = coordenadas[0].latitud;  // Cambia según la estructura del JSON
        const newLng = coordenadas[0].longitud; // Cambia según la estructura del JSON
        const fechaString = coordenadas[0].timestamp;
        let fecha = new Date(fechaString)
        let hora=fecha.getHours()
        let minutos = fecha.getUTCMinutes(); let segundos = fecha.getUTCSeconds();

        let formatoHora = `${hora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

        // Actualizar la posición del marcador
        marker.setLatLng([newLat, newLng]);
        map.setView([newLat, newLng], 18); // Mover el mapa

        // Crear un marcador en cada coordenada

        L.circleMarker([newLat, newLng], {
            radius: 1,  // Radio del círculo (más pequeño que el valor predeterminado)
            color: 'black',  // Color del borde
            fillColor: 'black',  // Color de relleno
            fillOpacity: 0.8,  // Opacidad del relleno
            className:'circulo-icon'
        }).addTo(map);

        
        // Determinar si está en una parada
        let estado = "En movimiento"; // Por defecto
        for (const parada of paradas) {
            const distancia = calcularDistancia(newLat, newLng, parada.latitud, parada.longitud);
            if (distancia < 0.01) { // Por ejemplo, 100 metros
                estado = "Detenido en " + parada.nombre; // Actualiza el estado
                break; // Salir del bucle si encuentra una parada
            }
        }

        // Mostrar el estado y hora en la interfaz
        document.getElementById('estadoColectivo').innerText = estado; // Actualiza el texto en la interfaz
        document.getElementById('horaColectivo').innerText = `Hora: ${formatoHora}`; // Muestra la hora extraída

    }
} 
  
// Calcular la distancia entre dos puntos
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distancia = R * c; // Distancia en km
    return distancia;
}

// Variable para almacenar todas las polilíneas var 
polilineas = [];



// Función para limpiar las polilíneas del mapa 
function limpiarLineas() { 
    borrarHorarios()
    polilineas.forEach(polyline => { map.removeLayer(polyline); }); polilineas = []; }// Vaciar el arreglo } // Añadir el evento al botón 
document.getElementById('limpiarLineas').addEventListener('click', limpiarLineas);


setInterval(moveMarker, 10000);  // Actualizar la ubicación del marcador cada 5 segundos

// Llamar a las funciones
getParadas(); // Cargar las paradas al inicio

// Función para mostrar la ruta de la línea
async function mostrarRuta(lineaId) {
    try {
        let response = await fetch(`https://geolocalizacion-api-ygyd.onrender.com/${lineaId}`);
        if (!response.ok) {
            throw new Error('Error en la respuesta de la red: ' + response.statusText);
        }

        const coordenadas = await response.json();
        const rutaColectivo = coordenadas.map(coord => [coord.latitud, coord.longitud]);

        limpiarLineas()

        // Dibujar la ruta en el mapa
        const polyline = L.polyline(rutaColectivo, { color: 'blue' }).addTo(map);

        polilineas.push(polyline)

        map.fitBounds(polyline.getBounds()); // Ajusta el mapa para ver toda la ruta

        getHorarios(lineaId); // Llamar a la función para obtener y mostrar los horarios de la línea
    } catch (error) {
        console.error('Error al obtener y mostrar la ruta:', error);
    }
}

// Función para cargar líneas en el panel
async function cargarLineas() {
    try {
        let response = await fetch(`https://geolocalizacion-api-ygyd.onrender.com/lineas`); // Cambia a la URL de tu API
        if (!response.ok) {
            throw new Error('Error al cargar líneas: ' + response.statusText);
        }
        const lineas = await response.json();

        const lineasList = document.getElementById('lineasList');
        lineasList.innerHTML = ''; // Limpiar la lista en caso de que ya haya elementos

        // Crear un elemento <li> por cada línea y añadirlo a la lista
        lineas.forEach(linea => {
            const listItem = document.createElement('li');
            listItem.textContent = linea.nombre; // Nombre de la línea
            listItem.dataset.lineaId = linea.id; // Guardar el ID de la línea en un atributo de datos

            // Agregar evento para que cuando se haga clic, se muestre la ruta en el mapa
            listItem.addEventListener('click', () => {
                mostrarRuta(linea.id); // Llama a mostrarRuta con el ID de la línea
            });

            lineasList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error al cargar líneas:', error);
    }
}


// Llama a cargarLineas para cargar las líneas al iniciar la página
cargarLineas();



