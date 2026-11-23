#!/usr/bin/env bash
# NovaVolt — pruebas end-to-end con curl
set -u
BASE="http://localhost:3000"
JAR_USER="/tmp/nv_user.cookies"
JAR_ADMIN="/tmp/nv_admin.cookies"
rm -f "$JAR_USER" "$JAR_ADMIN"
PASS=0; FAIL=0

req() { # method path jar data
  local m="$1" p="$2" jar="$3" data="${4:-}"
  if [ -n "$data" ]; then
    curl -s -o /tmp/nv_body.json -w "%{http_code}" -X "$m" "$BASE$p" -b "$jar" -c "$jar" -H 'Content-Type: application/json' -d "$data"
  else
    curl -s -o /tmp/nv_body.json -w "%{http_code}" -X "$m" "$BASE$p" -b "$jar" -c "$jar"
  fi
}
check() { # nombre esperado obtenido
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 ($3)";
  else FAIL=$((FAIL+1)); echo "  FAIL $1 — esperado $2, obtenido $3"; echo "       $(cat /tmp/nv_body.json)"; fi
}

echo "== Salud =="
check "GET /api/health" 200 "$(req GET /api/health "$JAR_USER")"

echo "== Registro y validaciones =="
check "registro con contraseña débil" 400 "$(req POST /api/auth/register "$JAR_USER" '{"nombre":"Test Uno","email":"test1@novavolt.co","password":"abc"}')"
check "registro con email inválido" 400 "$(req POST /api/auth/register "$JAR_USER" '{"nombre":"Test Uno","email":"no-es-email","password":"Segura123*"}')"
check "registro sin nombre" 400 "$(req POST /api/auth/register "$JAR_USER" '{"nombre":"","email":"test1@novavolt.co","password":"Segura123*"}')"
check "registro válido" 201 "$(req POST /api/auth/register "$JAR_USER" '{"nombre":"Test Uno","email":"test1@novavolt.co","password":"Segura123*"}')"
check "registro duplicado" 409 "$(req POST /api/auth/register "$JAR_USER" '{"nombre":"Test Dos","email":"test1@novavolt.co","password":"Segura123*"}')"
check "sesión persiste (/me)" 200 "$(req GET /api/auth/me "$JAR_USER")"
grep -q 'test1@novavolt.co' /tmp/nv_body.json && echo "  OK   /me devuelve el usuario" || { FAIL=$((FAIL+1)); echo "  FAIL /me no devuelve usuario"; }

echo "== Catálogo =="
check "GET /api/products" 200 "$(req GET /api/products "$JAR_USER")"
grep -q '"total":24' /tmp/nv_body.json && echo "  OK   24 productos" || { FAIL=$((FAIL+1)); echo "  FAIL total distinto de 24"; }
check "filtro categoría moto" 200 "$(req GET '/api/products?categoria=moto' "$JAR_USER")"
check "orden por precio ascendente" 200 "$(req GET '/api/products?orden=precio_asc' "$JAR_USER")"
check "búsqueda" 200 "$(req GET '/api/products?q=volta' "$JAR_USER")"
check "producto inexistente" 404 "$(req GET /api/products/99999 "$JAR_USER")"

echo "== Pedidos =="
check "compra válida" 201 "$(req POST /api/orders "$JAR_USER" '{"product_id":1,"cantidad":1}')"
check "cantidad inválida" 400 "$(req POST /api/orders "$JAR_USER" '{"product_id":1,"cantidad":0}')"
check "producto inexistente en compra" 404 "$(req POST /api/orders "$JAR_USER" '{"product_id":99999,"cantidad":1}')"
check "historial de compras" 200 "$(req GET /api/orders/mine "$JAR_USER")"

echo "== Chat =="
check "enviar mensaje" 201 "$(req POST /api/messages "$JAR_USER" '{"contenido":"Hola, quiero saber el precio de una moto eléctrica"}')"
grep -q 'de_admin":1' /tmp/nv_body.json && echo "  OK   respuesta automática del bot" || { FAIL=$((FAIL+1)); echo "  FAIL sin respuesta del bot"; }
check "historial de chat" 200 "$(req GET /api/messages/mine "$JAR_USER")"
check "estado del chat" 200 "$(req GET /api/messages/status "$JAR_USER")"

echo "== Admin =="
check "login admin" 200 "$(req POST /api/auth/login "$JAR_ADMIN" '{"email":"admin@novavolt.co","password":"Admin123*"}')"
check "stats admin" 200 "$(req GET /api/admin/stats "$JAR_ADMIN")"
check "listar productos admin" 200 "$(req GET /api/admin/products "$JAR_ADMIN")"
check "crear producto" 201 "$(req POST /api/admin/products "$JAR_ADMIN" '{"nombre":"Producto E2E","categoria":"software","precio_cop":1500000,"descripcion":"Producto de prueba automatizada","stock":5,"rating":4.5,"specs":[["Licencia","Anual"]],"activo":1}')"
NEW_ID=$(node -e "try{console.log(require('/tmp/nv_body.json').id)}catch(e){console.log('')}" 2>/dev/null)
[ -n "$NEW_ID" ] && echo "  OK   id de producto creado: $NEW_ID" || { FAIL=$((FAIL+1)); echo "  FAIL sin id de producto"; }
check "editar producto" 200 "$(req PUT /api/admin/products/$NEW_ID "$JAR_ADMIN" '{"nombre":"Producto E2E editado","categoria":"software","precio_cop":1600000,"descripcion":"Descripción editada","stock":7,"rating":4.7,"specs":[["Licencia","Anual"]],"activo":1}')"
check "desactivar producto" 200 "$(req PATCH /api/admin/products/$NEW_ID/toggle "$JAR_ADMIN")"
check "eliminar producto" 200 "$(req DELETE /api/admin/products/$NEW_ID "$JAR_ADMIN")"
check "listar usuarios" 200 "$(req GET /api/admin/users "$JAR_ADMIN")"
USER_ID=$(node -e "const b=require('/tmp/nv_body.json');const u=(b.usuarios||[]).find(x=>x.email==='test1@novavolt.co');console.log(u?u.id:'')" 2>/dev/null)
check "cambiar rol de usuario" 200 "$(req PATCH /api/admin/users/$USER_ID/rol "$JAR_ADMIN" '{"rol":"admin"}')"
check "revertir rol de usuario" 200 "$(req PATCH /api/admin/users/$USER_ID/rol "$JAR_ADMIN" '{"rol":"user"}')"
check "hilos de mensajes" 200 "$(req GET /api/admin/messages/threads "$JAR_ADMIN")"
check "leer conversación" 200 "$(req GET /api/admin/messages/$USER_ID "$JAR_ADMIN")"
check "responder conversación" 201 "$(req POST /api/admin/messages/$USER_ID "$JAR_ADMIN" '{"contenido":"Hola, soy tu asesor NovaVolt. Con gusto te ayudo."}')"
check "obtener settings" 200 "$(req GET /api/admin/settings "$JAR_ADMIN")"
check "guardar settings" 200 "$(req PUT /api/admin/settings "$JAR_ADMIN" '{"hero_titulo":"El futuro se mueve en silencio","hero_badge":"Movilidad eléctrica","hero_subtitulo":"Motos, autos, bicicletas y software hechos para Colombia.","nosotros_titulo":"Somos NovaVolt","nosotros_texto":"Diseñamos movilidad eléctrica y software para Colombia.","direccion":"Calle 48C 25-05, Bogotá","whatsapp":"+57 310 383 2322","correo":"Lozanoaguiarcristian@gmail.com","envio_texto":"Envíos a toda Colombia en 3 a 5 días hábiles.","franja_frases":["Uno","Dos","Tres","Cuatro","Cinco","Seis"]}')"
check "pedidos admin" 200 "$(req GET /api/admin/orders "$JAR_ADMIN")"
check "acceso admin denegado a usuario" 403 "$(req GET /api/admin/stats "$JAR_USER")"

echo "== Cierre de sesión =="
check "logout" 200 "$(req POST /api/auth/logout "$JAR_USER")"
check "/me tras logout" 200 "$(req GET /api/auth/me "$JAR_USER")"

echo
echo "RESULTADO: $PASS pruebas OK, $FAIL fallidas"
[ "$FAIL" -eq 0 ]
