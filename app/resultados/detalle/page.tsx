'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function DetalleResultados() {
  const [votos, setVotos] = useState<{ [key: string]: number }>({});
  const [cargando, setCargando] = useState(true);
  const [eleccionActiva, setEleccionActiva] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Redirección de seguridad si intentan entrar sin contraseña previa
    const sesionValida = sessionStorage.getItem('veedor_autenticado');
    if (sesionValida !== 'true') {
      router.push('/resultados');
      return;
    }

    const cargarDatos = async () => {
      const { data: datosVotos } = await supabase.from('votos').select('*');
      if (datosVotos) {
        const mapaVotos: { [key: string]: number } = {};
        datosVotos.forEach((fila) => { 
          const cant = fila.cantidad !== undefined ? fila.cantidad : (fila.quantity || 0);
          mapaVotos[fila.opcion] = cant; 
        });
        setVotos(mapaVotos);
      }

      const { data: datosEstado } = await supabase
        .from('estado_eleccion')
        .select('activa')
        .eq('id', 'configuracion_general')
        .single();
      if (datosEstado) setEleccionActiva(datosEstado.activa);

      setCargando(false);
    };

    cargarDatos();
  }, [router]);

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
        alert("Aún no existen registros individuales en la bitácora de auditoría.");
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
      console.error(err);
      alert("No se pudo extraer la bitácora.");
    } finally {
      setDescargando(false);
    }
  };

  const reabrirVotaciones = async () => {
    if (window.confirm('¿Está absolutamente seguro de REABRIR las votaciones desde este panel?')) {
      setEleccionActiva(true);
      await supabase
        .from('estado_eleccion')
        .update({ activa: true })
        .eq('id', 'configuracion_general');
      
      router.push('/resultados');
    }
  };

  const totalVotos = Object.values(votos).reduce((a, b) => a + b, 0);
  const maxVotos = Math.max(...Object.values(votos), 1);

  if (cargando) return <div className="p-8 text-center text-white bg-slate-950 h-screen flex items-center justify-center">Generando escrutinio estadístico...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto bg-slate-900/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-slate-800">
        
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 mb-8 gap-4">
          <div className="text-center md:text-left">
            <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              Reporte de Escrutinio Final Oficial
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-2 uppercase tracking-tight">
              Análisis Estadístico Detallado
            </h1>
          </div>
          <button
            onClick={() => router.push('/resultados')}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition-all font-bold uppercase tracking-wider border border-slate-700"
          >
            ⬅️ Volver al Monitoreo
          </button>
        </div>

        {/* GRÁFICOS COMPLEJOS: Panel de Columnas Comparativas */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8 text-center">
            Proporción Visual y Brecha Escrutada
          </h2>
          
          <div className="flex justify-around items-end h-72 pt-4 pb-8 px-4 border-b border-slate-800 gap-4">
            {Object.keys(votos).map((opcion) => {
              const cantidad = votos[opcion];
              const porcentaje = totalVotos > 0 ? Math.round((cantidad / totalVotos) * 100) : 0;
              const alturaGrafica = (cantidad / maxVotos) * 100;

              return (
                <div key={opcion} className="flex flex-col items-center flex-1 h-full justify-end group min-w-0">
                  <span className="text-xs font-black text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mb-2 whitespace-nowrap">
                    {cantidad} v
                  </span>
                  <div 
                    style={{ height: `${Math.max(alturaGrafica, 6)}%` }}
                    className="w-full max-w-[60px] bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400 rounded-t-xl transition-all duration-1000 ease-out shadow-lg shadow-blue-500/10 hover:brightness-110"
                  />
                  {/* SE CORRIGIÓ: Se quitó truncate/max-w-full y se puso whitespace-nowrap para evitar que se mochen los números */}
                  <span className="text-sm font-black text-white mt-4 mb-1 College tracking-wide whitespace-nowrap">{porcentaje}%</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider whitespace-nowrap">{opcion}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* TARJETAS DE MÉTRICAS ANALÍTICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Votos Totales</p>
            <p className="text-3xl font-black text-white mt-1">{totalVotos}</p>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Opciones Escrutadas</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">{Object.keys(votos).length}</p>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Estado de Urnas</p>
            <p className={`text-xl font-black mt-2 uppercase ${eleccionActiva ? 'text-emerald-500' : 'text-red-500'}`}>
              {eleccionActiva ? 'Abiertas' : 'Cerradas'}
            </p>
          </div>
        </div>

        {/* BOTONES DE CONTROL DE AUDITORÍA */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={descargarReporteVotos}
            disabled={descargando}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-xs px-8 py-4 rounded-xl shadow-lg transition-all active:scale-[0.99] uppercase tracking-wider flex items-center justify-center gap-2 border border-emerald-500/30 disabled:opacity-50"
          >
            {descargando ? '📊 Procesando reporte...' : '📥 Descargar Auditoría Cronológica (Excel)'}
          </button>

          <button
            onClick={reabrirVotaciones}
            className="bg-slate-950 hover:bg-slate-900 text-red-400 hover:text-red-300 font-bold text-xs px-6 py-4 rounded-xl transition-all border border-slate-800 hover:border-red-500/20 uppercase tracking-widest"
          >
            🔄 Reabrir Proceso de Votación
          </button>
        </div>

      </div>
    </div>
  );
}