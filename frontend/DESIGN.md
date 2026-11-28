# Diseño de TraceChain

La interfaz de operaciones combina papel marfil, vidrio esmerilado y tinta cálida. El acceso, la vista general y las cabeceras de los módulos comparten una composición de esfera naranja y cristal, dibujada con CSS para adaptarse al tamaño del contenedor. Es decorativa y se excluye del árbol de accesibilidad.

| Elemento | Tratamiento |
| --- | --- |
| Fondo | Arena, con luz cálida y degradado suave |
| Navegación y cabecera | Superficies translúcidas con desenfoque y relleno legible incluso sin soporte de filtro |
| Datos y formularios | Paneles claros, cantidades tabulares, campos delimitados y foco de teclado |
| Acciones | Botones redondeados; tinta oscura para la acción primaria y la ruta activa |
| Vista general | Encabezado editorial, métricas enlazadas y primera tarjeta oscura para destacar el total de lotes |
| Grafo | Violeta para el lote origen, leyenda y alternativa textual; el naranja decorativo no codifica nodos |

Los encabezados se adaptan al ancho. En pantallas pequeñas el menú permite abrir módulos y acceder a la sesión. Las tablas conservan su desplazamiento horizontal dentro del panel. El cristal y las esferas se desplazan una vez al entrar en la pantalla. Las métricas aparecen en secuencia y los controles responden al puntero y al foco. Con movimiento reducido la composición aparece en su posición final. Los colores y estilos se mantienen en `src/app/globals.css`.
