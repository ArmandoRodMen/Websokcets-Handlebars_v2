import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { engine } from 'express-handlebars';
import path from 'path';
import ContenedorMemoria from '../public/contenedores/ContenedorMemoria.js';
import { __dirname } from "./utils.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const productosApi = new ContenedorMemoria();

// Configura Handlebars como motor de plantillas
app.engine('.hbs', engine({ extname: '.hbs' }));
app.set('view engine', '.hbs');

// Configura Express para buscar vistas en la carpeta 'views' dentro de 'public'
app.set('views', path.join(__dirname, '../public/views'));

// Configura el socket
io.on('connection', async socket => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });

    // carga inicial de productos
    socket.emit('productos', productosApi.listarAll());

    // actualización de productos
    socket.on('update', producto => {
        productosApi.guardar(producto);
        io.sockets.emit('productos', productosApi.listarAll());
        console.log(`Producto actualizado`);
        
        // También puedes emitir el evento de actualización solo para el endpoint API
        io.of('/api').emit('productos', productosApi.listarAll());
    });
});

// Agregar un espacio de nombres (namespace) para el endpoint API
const apiNamespace = io.of('/api');
apiNamespace.on('connection', socket => {
    console.log(`Client connected to API namespace: ${socket.id}`);
    
    // carga inicial de productos para el cliente que se conecta al namespace API
    socket.emit('productos', productosApi.listarAll());
});

// Crear el enrutador
const router = express.Router();

// Ruta para obtener la lista de productos en formato JSON
router.get("/api/products", (req, res) => {
    res.json(productosApi.listarAll());
});

// Agregar el enrutador al espacio de nombres API
apiNamespace.use((socket, next) => {
    router(req, {}, next);
});

// Asegurar que las actualizaciones de productos se envíen también al espacio de nombres API
apiNamespace.on('connection', socket => {
    socket.on('update', producto => {
        productosApi.guardar(producto);
        apiNamespace.emit('productos', productosApi.listarAll());
    });
});

// Añadir el enrutador al servidor
app.use("/", router);

// Agrega middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Crea el enrutador
router.get("/", (req, res) => {
    res.render("home");  // No se especifica la extensión, ya que Handlebars se encargará de eso
});

router.get("/realTimeProducts", (req, res) => {
    res.render("tabla-productos");
});

// Inicia el servidor
const PORT = 8080;
const connectedServer = httpServer.listen(PORT, () => {
    console.log(`Servidor http escuchando en el puerto ${PORT}`);
});

connectedServer.on('error', error => console.log(`Error en servidor ${error}`));
