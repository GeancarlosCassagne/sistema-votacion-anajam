'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';


export default function VotacionEscolar() {
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [haVotado, setHaVotado] = useState(false);

  useEffect(() => {
    const traerOpciones = async () => {
      const { data, error } = await supabase.from('votos').select('opcion');
      if (!error && data) {
        setOpciones(data.map((fila) => fila.opcion));
      }
      setCargando(false);
    };
    traerOpciones();
  }, []);

  const manejarVoto = async (opcionSeleccionada: string) => {
    if (haVotado) return;

    // Traemos la cantidad actual para sumarle 1 de forma segura
    const { data } = await supabase
      .from('votos')
      .select('cantidad')
      .eq('opcion', opcionSeleccionada)
      .single();

    const cantidadActual = data?.cantidad || 0;

    const { error } = await supabase
      .from('votos')
      .update({ cantidad: cantidadActual + 1 })
      .eq('opcion', opcionSeleccionada);

    if (!error) {
      setHaVotado(true);
    }
  };

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-xl font-medium text-blue-900">
        Cargando sistema...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-white to-red-700 py-12 px-4 flex items-center justify-center font-sans">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 border-t-8 border-blue-800">
        
        {/* Encabezado con Logo y Título */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-24 h-24 mb-4">
            {/* Aquí llamamos a tu logo guardado en la carpeta public */}
            <img src="/logoanajam.png" alt="Logo ANAJAM" className="w-full h-full object-contain" />
          </div>
          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Proceso Electoral Autónomo
          </span>
          <h1 className="text-2xl font-black text-blue-900 mt-3 uppercase tracking-tight">
            Elección de consejo estudiantil ANAJAM 2026
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Por favor, selecciona la opción de tu preferencia. Tu voto es secreto.
          </p>
        </div>

        {/* Tarjetas de Opciones para Votar */}
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

        {haVotado && (
          <div className="text-center text-md font-bold text-white mt-6 bg-emerald-600 py-3 rounded-xl border border-emerald-700 shadow-md animate-bounce">
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