'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function VotacionEscolar() {
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [haVotado, setHaVotado] = useState(false);
  const [eleccionActiva, setEleccionActiva] = useState(true);

  useEffect(() => {
    const inicializarSistema = async () => {
      const { data: datosVotos } = await supabase.from('votos').select('opcion');
      if (datosVotos) setOpciones(datosVotos.map((fila) => fila.opcion));

      const { data: datosEstado } = await supabase
        .from('estado_eleccion')
        .select('activa')
        .eq('id', 'configuracion_general')
        .single();
      if (datosEstado) setEleccionActiva(datosEstado.activa);

      setCargando(false);
    };

    inicializarSistema();

    const canalEstado = supabase
      .channel('cambios-globales-veedor')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'estado_eleccion' }, (payload) => {
        const nuevoEstado = payload.new.activa;
        setEleccionActiva(nuevoEstado);
        
        if (nuevoEstado === true) {
          setHaVotado(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(canalEstado); };
  }, []);

  const manejarVoto = async (opcionSeleccionada: string) => {
    if (haVotado || !eleccionActiva) return;

    // BANNER DE VALIDACIÓN: Pregunta al alumno si está seguro antes de guardar nada
    const seguro = window.confirm(`¿Está seguro de que desea emitir su voto por: "${opcionSeleccionada}"? Una vez confirmado, no podrá cambiar su elección.`);
    
    // Si el alumno presiona "Cancelar", detenemos la función y no pasa nada
    if (!seguro) return;

    // Si presiona "Aceptar", bloqueamos el botón inmediatamente para mitigar doble clic
    setHaVotado(true);

    const { data } = await supabase
      .from('votos')
      .select('*')
      .eq('opcion', opcionSeleccionada)
      .single();

    const cantidadActual = data?.cantidad !== undefined ? data.cantidad : (data?.quantity || 0);

    const { error } = await supabase
      .from('votos')
      .update({ cantidad: cantidadActual + 1, quantity: cantidadActual + 1 })
      .eq('opcion', opcionSeleccionada);

    if (error) {
      setHaVotado(false); // Si falla la conexión por red, le permite reintentar
    }
  };

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-xl font-medium text-blue-900">
        Cargando sistema de votación...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-white to-red-700 py-12 px-4 flex items-center justify-center font-sans">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 border-t-8 border-blue-800">
        
        {/* Encabezado */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-24 h-24 mb-4">
            <img src="/logoanajam.png" alt="Logo ANAJAM" className="w-full h-full object-contain" />
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider transition-colors duration-500 ${
            eleccionActiva ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
          }`}>
            {eleccionActiva ? 'Urnas Abiertas' : 'Urnas Cerradas'}
          </span>
          <h1 className="text-2xl font-black text-blue-900 mt-3 uppercase tracking-tight">
            Elección de consejo estudiantil ANAJAM 2026
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            {eleccionActiva 
              ? 'Por favor, selecciona la opción de tu preferencia. Tu voto es secreto.' 
              : 'El proceso de votación ha concluido oficialmente por disposición de la junta electoral.'}
          </p>
        </div>

        {/* Contenido Dinámico */}
        {eleccionActiva ? (
          <div className="space-y-4">
            {opciones.map((opcion) => (
              <div key={opcion} className="bg-slate-50 p-4 rounded-xl border-2 border-slate-100 hover:border-blue-300 transition-all">
                <button
                  disabled={haVotado}
                  onClick={() => manejarVoto(opcion)}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow transition-all ${
                    haVotado
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-800 to-blue-700 hover:from-blue-900 hover:to-blue-800 text-white hover:shadow-lg active:scale-[0.99]'
                  }`}
                >
                  {haVotado ? 'Voto emitido ✓' : `Votar por ${opcion}`}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-medium">
            🔒 El período para ejercer el voto ha finalizado. Agradecemos su participación.
          </div>
        )}

        {haVotado && eleccionActiva && (
          <div className="text-center text-md font-bold text-white mt-6 bg-emerald-600 py-3 rounded-xl border border-emerald-700 shadow-md animate-pulse">
            ¡Tu voto ha sido registrado con éxito! 🎉
          </div>
        )}

        <div className="text-center text-[10px] text-gray-400 mt-8 uppercase tracking-widest">
          ANAJAM • Sistema de Votación Automatizado
        </div>
      </div>
    </div>
  );
}