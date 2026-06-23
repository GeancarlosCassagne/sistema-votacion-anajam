'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function VotacionEscolar() {
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [haVotado, setHaVotado] = useState(false);
  const [eleccionActiva, setEleccionActiva] = useState(true);

  // Estados del Modal
  const [mostrarModal, setMostrarModal] = useState(false);
  const [opcionSeleccionada, setOpcionSeleccionada] = useState('');
  const [procesandoVoto, setProcesandoVoto] = useState(false);

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
      .channel('cambios-estado-votante-estricto')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'estado_eleccion' }, (payload) => {
        const nuevoEstadoGlobal = payload.new.activa;
        setEleccionActiva(nuevoEstadoGlobal);
        
        if (nuevoEstadoGlobal === true) {
          setHaVotado(false);
          setMostrarModal(false);
          setProcesandoVoto(false);
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(canalEstado); 
    };
  }, []);
  
  const previsualizarVoto = (opcion: string) => {
    if (haVotado || !eleccionActiva || procesandoVoto) return;
    setOpcionSeleccionada(opcion);
    setMostrarModal(true);
  };

  const confirmarVoto = async () => {
    if (procesandoVoto) return;
    setProcesandoVoto(true);

    try {
      const { data: filaActual, error: errorFetch } = await supabase
        .from('votos')
        .select('cantidad')
        .eq('opcion', opcionSeleccionada)
        .maybeSingle();

      if (errorFetch) throw errorFetch;
      const nuevaCantidad = (filaActual?.cantidad || 0) + 1;

      // 1. Guarda en la tabla acumulativa para las gráficas del veedor
      await supabase
        .from('votos')
        .upsert({ opcion: opcionSeleccionada, cantidad: nuevaCantidad }, { onConflict: 'opcion' });

      // 2. GUARDA EN EL HISTORIAL (Registra voto individual con fecha y hora automática)
      await supabase
        .from('historial_votos')
        .insert({ opcion: opcionSeleccionada });

      setHaVotado(true);
      setMostrarModal(false);

    } catch (error) {
      console.error("Error al registrar el voto:", error);
      alert("Inconveniente al registrar el voto. Por favor, intenta presionar Confirmar nuevamente.");
    } finally {
      setProcesandoVoto(false);
    }
  };

  const habilitarSiguienteVotante = () => {
    setOpcionSeleccionada('');
    setHaVotado(false);
    setMostrarModal(false);
    setProcesandoVoto(false);
  };

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-xl font-medium text-blue-900">
        Cargando sistema de votación...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-white to-red-700 py-12 px-4 flex items-center justify-center font-sans relative overflow-hidden">
      
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 border-t-8 border-blue-800 z-10">
        
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
              ? (haVotado ? 'Su sufragio ha sido procesado por el sistema.' : 'Por favor, selecciona la opción de tu preferencia. Tu voto es secreto.')
              : 'El proceso de votación ha concluido oficialmente por disposición de la junta electoral.'}
          </p>
        </div>

        {/* Contenido Dinámico */}
        {!eleccionActiva ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 font-medium">
            🔒 El período para ejercer el voto ha finalizado. Agradecemos su participación.
          </div>
        ) : haVotado ? (
          <div className="space-y-6 animate-scale-up">
            <div className="text-center text-md font-bold text-white bg-emerald-600 py-4 px-6 rounded-xl border border-emerald-700 shadow-md">
              <span className="text-2xl block mb-1">🎉</span>
              ¡Tu voto ha sido registrado con éxito!
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Por favor, retírese de la urna digital para resguardar el secreto del voto y permita que el siguiente estudiante se acerque a la mesa.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <button
                onClick={habilitarSiguienteVotante}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-5 rounded-lg transition-all uppercase tracking-wider shadow active:scale-[0.98]"
              >
                🔄 Siguiente Votante (Uso de la Mesa)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {opciones.map((opcion) => (
              <div key={opcion} className="bg-slate-50 p-4 rounded-xl border-2 border-slate-100 hover:border-blue-300 transition-all">
                <button
                  disabled={procesandoVoto}
                  onClick={() => previsualizarVoto(opcion)}
                  className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow transition-all bg-gradient-to-r from-blue-800 to-blue-700 hover:from-blue-900 hover:to-blue-800 text-white hover:shadow-lg active:scale-[0.99]"
                >
                  Votar por {opcion}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-center text-[10px] text-gray-400 mt-8 uppercase tracking-widest">
          ANAJAM • Sistema de Votación Automatizado
        </div>
      </div>

      {/* MODAL PERSONALIZADO */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-8 border-red-600 transform scale-100 transition-all animate-scale-up">
            
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 text-xl mb-4">
                🗳️
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                ¿Confirmar tu voto?
              </h3>
              <div className="mt-3 px-2 py-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Has seleccionado:</p>
                <p className="text-2xl font-black text-blue-900 mt-1 tracking-wide">
                  {opcionSeleccionada}
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                Una vez que presiones <strong>Confirmar Voto</strong>, tu decisión se enviará de forma permanente y la urna digital se cerrará para el siguiente estudiante.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                disabled={procesandoVoto}
                onClick={() => setMostrarModal(false)}
                className="w-full order-2 sm:order-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm uppercase tracking-wider"
              >
                Regresar
              </button>
              <button
                disabled={procesandoVoto}
                onClick={confirmarVoto}
                className="w-full order-1 sm:order-2 py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black rounded-xl shadow-md hover:shadow-lg transition-all text-sm uppercase tracking-wider active:scale-[0.98]"
              >
                {procesandoVoto ? 'Guardando Voto...' : 'Confirmar Voto'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}