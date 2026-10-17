// Alta y baja de usuarios. Solo admins. Usa la service role key, por eso vive en el servidor.
//   POST   /api/usuarios        { nombre, email, password, rol }
//   DELETE /api/usuarios?id=ID  (id de la tabla usuarios)
import { adminClient, getCaller, httpError, readJson, sendError } from "./_lib.js";

const ROLES = ["admin", "operario", "finanzas", "arquitecto"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default async function handler(req, res) {
  try {
    await getCaller(req, ["admin"]);
    const db = adminClient();

    if (req.method === "POST") {
      const { nombre, email, password, rol } = await readJson(req);
      const mail = (email || "").trim().toLowerCase();
      if (!nombre?.trim() || !mail || !password) throw httpError(400, "Completá nombre, email y contraseña.");
      if (password.length < 6) throw httpError(400, "La contraseña debe tener al menos 6 caracteres.");
      if (!ROLES.includes(rol)) throw httpError(400, "Rol inválido.");

      const id = uid();
      const { data, error } = await db.auth.admin.createUser({
        email: mail, password, email_confirm: true,
        app_metadata: { rol, usuario_id: id },
        user_metadata: { nombre: nombre.trim() },
      });
      if (error) throw httpError(400, /already/i.test(error.message) ? "Ya existe un usuario con ese email." : error.message);

      const fila = { id, nombre: nombre.trim(), email: mail, rol, auth_id: data.user.id };
      const { error: e2 } = await db.from("usuarios").insert(fila);
      if (e2) { await db.auth.admin.deleteUser(data.user.id); throw e2; }
      return res.status(200).json(fila);
    }

    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (!id) throw httpError(400, "Falta el id.");
      if (id === "admin") throw httpError(400, "El usuario admin principal no se puede eliminar.");
      const { data: fila, error } = await db.from("usuarios").select("id, auth_id").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!fila) throw httpError(404, "Usuario no encontrado.");
      if (fila.auth_id) {
        const { error: e2 } = await db.auth.admin.deleteUser(fila.auth_id);
        if (e2 && !/not.?found/i.test(e2.message)) throw e2;
      }
      const { error: e3 } = await db.from("usuarios").delete().eq("id", id);
      if (e3) throw e3;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    res.status(405).json({ error: "Método no permitido" });
  } catch (e) { sendError(res, e); }
}
