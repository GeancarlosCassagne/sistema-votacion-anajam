'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

const CONTRASEÑA_ADMIN = 'ANAJAM2026'; 

export default function PantallaVeedor() {
  const [votos, setVotos] = useState<{ [key: string]: number }>({});
  const [cargando, setCargando] = useState(true);
  const [eleccionActiva, setEleccionActiva] = useState(true);
  const router = useRouter();

  // Seguridad
  const [autenticado, setAutenticado] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState(false);

  useEffect(() => {
    const sesionValida = sessionStorage.getItem('veedor_autenticado');
    if (sesionValida === 'true') setAutenticado(true);

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
      : '¿Está seguro de CERRAR las votaciones? Se bloquearán las urnas y se habilitará el reporte detallado.';

    if (window.confirm(mensaje)) {
      setEleccionActiva(nuevoEstado);
      await supabase
        .from('estado_eleccion')
        .update({ activa: nuevoEstado })
        .eq('id', 'configuracion_general');
      
      if (!nuevoEstado) {
        router.push('/resultados/detalle');
      }
    }
  };

  const totalVotos = Object.values(votos).reduce((a, b) => a + b, 0);

  if (cargando) return <div className="p-8 text-center text-white bg-slate-950 h-screen flex items-center justify-center">Cargando escrutinio...</div>;

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-red-900/40 text-center">
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-950 border border-red-500/30 text-red-400 text-2xl mb-4">🔒</div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-100">Panel Restringido</h2>
          <p className="text-xs text-slate-400 mt-2 font-medium">Se requiere autenticación para acceder al escrutinio en vivo.</p>
          <form onSubmit={manejarLogin} className="mt-6 space-y-4">
            <input
              type="password"
              placeholder="Ingresa la clave de acceso"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-center font-bold tracking-widest text-white transition-all outline-none"
            />
            {errorPassword && <p className="text-red-500 text-xs font-bold mt-2 animate-pulse">⚠️ Contraseña incorrecta.</p>}
            <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-xs py-3.5 px-4 rounded-xl uppercase tracking-wider">Verificar Identidad</button>
          </form>
        </div>
      </div>
    );
  }

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
            {eleccionActiva ? 'Elecciones en Proceso • En Vivo 📡' : 'Votaciones Cerradas 🔒'}
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white mt-4 uppercase tracking-tight">
            Monitoreo en Tiempo Real
          </h1>
        </div>

        {/* Gráficos en vivo simplificados */}
        <div className="space-y-6">
          {Object.keys(votos).map((opcion) => {
            const cantidad = votos[opcion];
            const porcentaje = totalVotos > 0 ? Math.round((cantidad / totalVotos) * 100) : 0;
            return (
              <div key={opcion} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg text-slate-200">{opcion}</span>
                  <span className="font-black text-xl text-blue-400">{cantidad} <span className="text-xs text-slate-500 font-normal">votos ({porcentaje}%)</span></span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden p-0.5 border border-slate-800">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${porcentaje}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Acciones del Administrador */}
        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col items-center gap-4">
          <div className="bg-slate-950 px-6 py-2 rounded-xl border border-slate-800 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Emitido</p>
            <p className="text-2xl font-black text-white">{totalVotos} votos</p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center w-full mt-2">
            {eleccionActiva ? (
              <button
                onClick={() => cambiarEstadoEleccion(false)}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider transition-all"
              >
                🛑 Cerrar Votaciones y Ver Detalle
              </button>
            ) : (
              <>
                <button
                  onClick={() => cambiarEstadoEleccion(true)}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider transition-all"
                >
                  🔄 Reabrir Urnas Digitales
                </button>
                <button
                  onClick={() => router.push('/resultados/detalle')}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider transition-all border border-slate-700"
                >
                  📊 Ver Escrutinio Detallado
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}