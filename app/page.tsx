'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

// 🔑 CONTRASEÑA PARA DESBLOQUEAR ESTA TABLET/MESA DE VOTACIÓN
const CONTRASEÑA_VOTANTE = 'URNAS2026'; 

export default function VotacionEscolar() {
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [haVotado, setHaVotado] = useState(false);
  const [eleccionActiva, setEleccionActiva] = useState(true);

  // Estados del Modal
  const [mostrarModal, setMostrarModal] = useState(false);
  const [opcionSeleccionada, setOpcionSeleccionada] = useState('');
  const [procesandoVoto, setProcesandoVoto] = useState(false);

  // Estados de Validación de Seguridad para la Estación
  const [autenticado, setAutenticado] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState(false);

  useEffect(() => {
    // Verificamos si esta mesa ya fue activada previamente en esta pestaña
    const sesionValida = sessionStorage.getItem('urna_desbloqueada');
    if (sesionValida === 'true') {
      setAutenticado(true);
    }

    const inicializarSistema = async () => {
      // 🔄 Consultamos tu nueva vista ordenada directamente desde PostgreSQL (Lista A siempre arriba)
      const { data: datosVotos } = await supabase
        .from('lista_votos_ordenada')
        .select('opcion');

      if (datosVotos) {
        setOpciones(datosVotos.map((fila) => fila.opcion));
      }

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

  const manejarDesbloqueoUrna = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === CONTRASEÑA_VOTANTE) {
      setAutenticado(true);
      setErrorPassword(false);
      sessionStorage.setItem('urna_desbloqueada', 'true');
    } else {
      setErrorPassword(true);
      setPasswordInput('');
    }
  };
  
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

      // 2. GUARDA EN EL HISTORIAL (Registra el voto con la estampa UTC limpia)
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

  // 🔒 PANTALLA DE PROTECCIÓN: Exige la contraseña al docente para abrir la estación de votación
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-blue-900/40 text-center">
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-blue-950 border border-blue-500/30 text-blue-400 text-2xl mb-4">🗳️</div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-100">Urna Protegida</h2>
          <p className="text-xs text-slate-400 mt-2 font-medium">El docente técnico debe ingresar la credencial para habilitar esta estación de sufragio.</p>
          <form onSubmit={manejarDesbloqueoUrna} className="mt-6 space-y-4">
            <input
              type="password"
              placeholder="Clave de apertura de mesa"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-center font-bold tracking-widest text-white transition-all outline-none"
            />
            {errorPassword && <p className="text-red-500 text-xs font-bold mt-2 animate-pulse">⚠️ Clave incorrecta. Inténtalo de nuevo.</p>}
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black text-xs py-3.5 px-4 rounded-xl uppercase tracking-wider transition-all">Habilitar Estación</button>
          </form>
        </div>
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
            {opciones.map((opcion) => {
              // Condicional estética: Evaluamos si es la Lista A para renderizar en gama roja
              const esListaA = opcion.toUpperCase() === 'LISTA A';

              return (
                <div 
                  key={opcion} 
                  className={`p-4 rounded-xl border-2 transition-all ${
                    esListaA 
                      ? 'bg-red-50/50 border-red-100 hover:border-red-300' 
                      : 'bg-slate-50 border-slate-100 hover:border-blue-300'
                  }`}
                >
                  <button
                    disabled={procesandoVoto}
                    onClick={() => previsualizarVoto(opcion)}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow transition-all hover:shadow-lg active:scale-[0.99] ${
                      esListaA
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                        : 'bg-gradient-to-r from-blue-800 to-blue-700 hover:from-blue-900 hover:to-blue-800 text-white'
                    }`}
                  >
                    Votar por {opcion}
                  </button>
                </div>
              );
            })}
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