'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function PantallaVeedor() {
  const [votos, setVotos] = useState<{ [key: string]: number }>({});
  const [cargando, setCargando] = useState(true);
  const [votacionCerrada, setVotacionCerrada] = useState(false);

  useEffect(() => {
    const traerVotos = async () => {
      const { data } = await supabase.from('votos').select('*');
      if (data) {
        const mapaVotos: { [key: string]: number } = {};
        data.forEach((fila) => { mapaVotos[fila.opcion] = fila.cantidad; });
        setVotos(mapaVotos);
      }
      setCargando(false);
    };

    traerVotos();

    const canal = supabase
      .channel('resultados-veedor')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'votos' }, (payload) => {
        const { opcion, quantity } = payload.new; // Se adapta a la estructura de la base
        const cantidad = payload.new.cantidad !== undefined ? payload.new.cantidad : quantity;
        setVotos((prev) => ({ ...prev, [opcion]: cantidad }));
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, []);

  const manejarCierre = () => {
    const seguro = window.confirm('¿Está absolutamente seguro de cerrar las votaciones? Una vez hecho, se mostrarán los resultados definitivos ante el público.');
    if (seguro) {
      setVotacionCerrada(true);
    }
  };

  const totalVotos = Object.values(votos).reduce((a, b) => a + b, 0);

  if (cargando) return <div className="p-8 text-center text-white bg-slate-950 h-screen flex items-center justify-center">Cargando escrutinio...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 border-2 border-blue-900/50">
        
        {/* Encabezado Común */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-20 h-20 mb-3 bg-white/10 p-2 rounded-2xl border border-white/20">
            <img src="/logoanajam.png" alt="Logo ANAJAM" className="w-full h-full object-contain" />
          </div>
          <span className={`text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-md ${
            votacionCerrada ? 'bg-red-600' : 'bg-emerald-600 animate-pulse'
          }`}>
            {votacionCerrada ? 'Votaciones Cerradas • Resultados Oficiales 🔒' : 'Elecciones en Proceso • En Vivo 📡'}
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white mt-4 uppercase tracking-tight">
            Elección de consejo estudiantil ANAJAM 2026
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {votacionCerrada ? 'Escrutinio final verificado por la junta electoral' : 'El sistema se encuentra recibiendo los sufragios en las urnas digitales'}
          </p>
        </div>

        {/* PANTALLA 1: VOTACIÓN EN CURSO (Oculta los gráficos y muestra el botón) */}
        {!votacionCerrada ? (
          <div className="text-center py-12 px-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-2xl mb-4 animate-spin">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-slate-200 mb-2">Las mesas electorales siguen abiertas</h2>
            <p className="text-slate-400 text-sm max-w-md mb-8">
              Los votos se están procesando de forma segura y en tiempo real. Presione el botón inferior únicamente cuando la última mesa haya concluido su jornada.
            </p>
            
            <button
              onClick={manejarCierre}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-md px-8 py-4 rounded-xl shadow-lg hover:shadow-red-900/30 active:scale-[0.99] transition-all uppercase tracking-wide border border-red-500/30"
            >
              Cerrar votaciones y mostrar resultados
            </button>
          </div>
        ) : (
          /* PANTALLA 2: RESULTADOS FINALES (Se revela la magia) */
          <div className="space-y-8 animate-fade-in">
            {Object.keys(votos).map((opcion) => {
              const cantidad = votos[opcion];
              const porcentaje = totalVotos > 0 ? Math.round((cantidad / totalVotos) * 100) : 0;

              return (
                <div key={opcion} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/40">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-xl font-bold text-white tracking-wide">{opcion}</span>
                    <span className="text-3xl font-black text-red-500">
                      {cantidad} <span className="text-xs text-slate-400 font-normal">votos</span> — <span className="text-white">{porcentaje}%</span>
                    </span>
                  </div>
                  {/* Contenedor de la barra */}
                  <div className="w-full bg-slate-950 rounded-full h-7 overflow-hidden p-1 shadow-inner border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-blue-600 via-blue-500 to-white h-full rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Resumen Total */}
            <div className="mt-10 text-center border-t border-slate-800 pt-6">
              <div className="inline-block bg-slate-950 px-8 py-3 rounded-2xl border border-slate-800">
                <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total General Emitido</p>
                <p className="text-4xl font-black text-white mt-1">{totalVotos} sufragios</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}