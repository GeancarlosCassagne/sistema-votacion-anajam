'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 🔑 DEFINE AQUÍ LA CONTRASEÑA DE ADMINISTRADOR QUE DESEES
const CONTRASEÑA_ADMIN = 'ANAJAM2026'; 

export default function PantallaVeedor() {
  const [votos, setVotos] = useState<{ [key: string]: number }>({});
  const [cargando, setCargando] = useState(true);
  const [eleccionActiva, setEleccionActiva] = useState(true);
  const [descargando, setDescargando] = useState(false);

  // Estados para la validación de seguridad
  const [autenticado, setAutenticado] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState(false);

  useEffect(() => {
    // Verificamos si ya introdujo la contraseña correctamente en esta sesión
    const sesionValida = sessionStorage.getItem('veedor_autenticado');
    if (sesionValida === 'true') {
      setAutenticado(true);
    }

    const cargarDatos = async () => {
      // 1. Obtener votos
      const { data: datosVotos } = await supabase.from('votos').select('*');
      if (datosVotos) {
        const mapaVotos: { [key: string]: number } = {};
        datosVotos.forEach((fila) => { 
          const cant = fila.cantidad !== undefined ? fila.cantidad : (fila.quantity || 0);
          mapaVotos[fila.opcion] = cant; 
        });
        setVotos(mapaVotos);
      }

      // 2. Obtener estado de la elección
      const { data: datosEstado } = await supabase
        .from('estado_eleccion')
        .select('activa')
        .eq('id', 'configuracion_general')
        .single();
      if (datosEstado) setEleccionActiva(datosEstado.activa);

      setCargando(false);
    };

    cargarDatos();

    // CANAL ÚNICO EN TIEMPO REAL
    const canalSincronizacion = supabase
      .channel('cambios-globales-veedor')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'votos' }, (payload) => {
        const { opcion } = payload.new;
        const cant = payload.new.cantidad !== undefined ? payload.new.cantidad : (payload.new.quantity || 0);
        setVotos((prev) => ({ ...prev, [opcion]: cant }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'estado_eleccion' }, (payload) => {
        setEleccionActiva(payload.new.activa);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalSincronizacion);
    };
  }, []);

  // Función para validar el acceso de administración
  const manejarLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === CONTRASEÑA_ADMIN) {
      setAutenticado(true);
      setErrorPassword(false);
      sessionStorage.setItem('veedor_autenticado', 'true');
    } else {
      setErrorPassword(true);
      setPasswordInput('');
    }
  };

  const cambiarEstadoEleccion = async (nuevoEstado: boolean) => {
    const mensaje = nuevoEstado 
      ? '¿Está seguro de REABRIR las votaciones? Los alumnos podrán volver a votar inmediatamente.'
      : '¿Está absolutamente seguro de CERRAR las votaciones? Se bloqueará la interfaz de los votantes y se revelará el escrutinio final.';

    if (window.confirm(mensaje)) {
      setEleccionActiva(nuevoEstado);
      
      await supabase
        .from('estado_eleccion')
        .update({ activa: nuevoEstado })
        .eq('id', 'configuracion_general');
    }
  };

  const descargarReporteVotos = async () => {
    if (descargando) return;
    setDescargando(true);

    try {
      const { data: historial, error } = await supabase
        .from('historial_votos')
        .select('id, opcion, fecha_hora')
        .order('id', { ascending: true });

      if (error) throw error;

      if (!historial || historial.length === 0) {
        alert("Aún no existen registros de votos individuales en la bitácora de auditoría.");
        setDescargando(false);
        return;
      }

      let contenidoCsv = "Nro Voto;Opcion Seleccionada;Fecha y Hora del Sufragio\n";

      historial.forEach((voto, index) => {
        const fechaFormateada = new Date(voto.fecha_hora).toLocaleString('es-EC', {
          timeZone: 'America/Guayaquil'
        });
        contenidoCsv += `${index + 1};${voto.opcion};${fechaFormateada}\n`;
      });

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], {
        type: 'text/csv;charset=utf-8;'
      });

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Auditoria_Votos_ANAJAM_2026.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Error al exportar los datos:", err);
      alert("No se pudo extraer la bitácora de auditoría de Supabase.");
    } finally {
      setDescargando(false);
    }
  };

  const totalVotos = Object.values(votos).reduce((a, b) => a + b, 0);

  if (cargando) return <div className="p-8 text-center text-white bg-slate-950 h-screen flex items-center justify-center">Cargando escrutinio...</div>;

  // 🔒 SI NO ESTÁ AUTENTICADO, MUESTRA LA PANTALLA DE ACCESO RESTRINGIDO
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-red-900/40 text-center">
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-950 border border-red-500/30 text-red-400 text-2xl mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-100">Panel Restringido</h2>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            Se requiere autenticación de la junta electoral o veedor autorizado para acceder al escrutinio.
          </p>

          <form onSubmit={manejarLogin} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                placeholder="Ingresa la clave de acceso"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-center font-bold tracking-widest text-white transition-all outline-none"
              />
              {errorPassword && (
                <p className="text-red-500 text-xs font-bold mt-2 animate-pulse">
                  ⚠️ Contraseña incorrecta. Inténtalo de nuevo.
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-xs py-3.5 px-4 rounded-xl transition-all uppercase tracking-wider shadow-md"
            >
              Verificar Identidad
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 📡 SI PASA LA VALIDACIÓN, RENDERIZA EL PANEL ORIGINAL DEL VEEDOR
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 border-2 border-blue-900/50">
        
        {/* Encabezado */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-20 h-20 mb-3 bg-white/10 p-2 rounded-2xl border border-white/20">
            <img src="/fondoblanco.png" alt="Logo ANAJAM" className="w-full h-full object-contain" />
          </div>
          <span className={`text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-md transition-all duration-500 ${
            eleccionActiva ? 'bg-emerald-600 animate-pulse' : 'bg-red-600'
          }`}>
            {eleccionActiva ? 'Elecciones en Proceso • En Vivo 📡' : 'Votaciones Cerradas • Resultados Oficiales 🔒'}
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white mt-4 uppercase tracking-tight">
            Elección de consejo estudiantil ANAJAM 2026
          </h1>
          <p className="text-slate-400 text-sm mt-1 transition-all">
            {eleccionActiva ? 'El sistema se encuentra recibiendo los sufragios en las urnas digitales' : 'Escrutinio final verificado por la junta electoral'}
          </p>
        </div>

        {/* CONTENIDO INTERMITENTE REACTIVO */}
        {eleccionActiva ? (
          <div className="text-center py-12 px-4 bg-slate-850/50 rounded-2xl border border-slate-800 flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-2xl mb-4 animate-spin">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-slate-200 mb-2">Las mesas electorales siguen abiertas</h2>
            <p className="text-slate-400 text-sm max-w-md mb-8">
              Los votos se están registrando de forma segura. Al presionar el botón inferior se inhabilitará la app de los alumnos y se revelarán los gráficos de barras.
            </p>
            <button
              onClick={() => cambiarEstadoEleccion(false)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-md px-8 py-4 rounded-xl shadow-lg hover:shadow-red-900/30 active:scale-[0.99] transition-all uppercase tracking-wide border border-red-500/30"
            >
              Cerrar votaciones y mostrar resultados
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(votos).map((opcion) => {
              const cantidad = votos[opcion];
              const porcentaje = totalVotos > 0 ? Math.round((cantidad / totalVotos) * 100) : 0;

              return (
                <div key={opcion} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/40 transform transition-all duration-500">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-xl font-bold text-white tracking-wide">{opcion}</span>
                    <span className="text-3xl font-black text-red-500">
                      {cantidad} <span className="text-xs text-slate-400 font-normal">votos</span> — <span className="text-white">{porcentaje}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-7 overflow-hidden p-1 shadow-inner border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-blue-600 via-blue-500 to-white h-full rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Resumen Total y Acciones del Cierre */}
            <div className="mt-10 text-center border-t border-slate-800 pt-6 flex flex-col items-center gap-6">
              <div className="inline-block bg-slate-950 px-8 py-3 rounded-2xl border border-slate-800 w-full max-w-sm">
                <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total General Emitido</p>
                <p className="text-4xl font-black text-white mt-1">{totalVotos} sufragios</p>
              </div>

              {/* Botón de Auditoría Cronológica para Excel */}
              <button
                onClick={descargarReporteVotos}
                disabled={descargando}
                className="w-full max-w-sm bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.99] uppercase tracking-wider flex items-center justify-center gap-2 border border-emerald-500/30 disabled:opacity-50"
              >
                {descargando ? (
                  <>📊 Procesando reporte...</>
                ) : (
                  <>📥 Descargar Auditoría Excel (CSV)</>
                )}
              </button>

              <button
                onClick={() => cambiarEstadoEleccion(true)}
                className="text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors uppercase tracking-widest border border-slate-800 hover:border-emerald-500/20 bg-slate-950/40 px-4 py-2 rounded-lg mt-4"
              >
                🔄 Reabrir proceso de votación
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}