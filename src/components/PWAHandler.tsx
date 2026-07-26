/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Download, Share2, PlusSquare, X, Check, Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react";
import { SERVITIUM_LOGO_BASE64 } from "../assets/logoConstant";

export default function PWAHandler() {
  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroidInstallBanner, setShowAndroidInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // iOS prompt states
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  // Network connection status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [connectionType, setConnectionType] = useState<"online" | "offline">("online");

  // Update status (new SW version)
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // 1. Detect if the app is already running in standalone (installed) mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // 2. Detect iOS Device
    const checkIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(userAgent) || 
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /macintel/.test(userAgent));
      setIsIosDevice(!!isIos);
      return !!isIos;
    };

    const ios = checkIos();

    // 3. Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully:', registration);
          setSwRegistration(registration);

          // Listen for updates to the service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // A new Service Worker is available, notify the user!
                  setNewVersionAvailable(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    }

    // 4. Intercept beforeinstallprompt for Android / Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Check if user previously declined within the last 24 hours
      const lastDeclined = localStorage.getItem("pwa-prompt-declined");
      const declinedRecent = lastDeclined && (Date.now() - parseInt(lastDeclined, 10) < 24 * 60 * 60 * 1000);

      if (!standalone && !declinedRecent) {
        setShowAndroidInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Detect when PWA successfully installed
    const handleAppInstalled = () => {
      console.log("[PWA] Application successfully installed!");
      setDeferredPrompt(null);
      setShowAndroidInstallBanner(false);
      setIsStandalone(true);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // 6. Handle iOS Tutorial Prompt triggers
    const showIosTutorialIfNeeded = () => {
      const hasDismissedIos = localStorage.getItem("pwa-ios-dismissed") === "true";
      if (ios && !standalone && !hasDismissedIos) {
        setShowIosPrompt(true);
      }
    };
    showIosTutorialIfNeeded();

    // 7. Network Connection Listeners
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionType("online");
      setShowConnectionToast(true);
      setTimeout(() => setShowConnectionToast(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionType("offline");
      setShowConnectionToast(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup listeners
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Action: Handle native install trigger
  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser's native install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install choice outcome: ${outcome}`);
    
    // Clear prompt state
    setDeferredPrompt(null);
    setShowAndroidInstallBanner(false);
  };

  // Action: Decline install banner (apply 24h frequency limit)
  const handleDeclineAndroidPrompt = () => {
    localStorage.setItem("pwa-prompt-declined", Date.now().toString());
    setShowAndroidInstallBanner(false);
  };

  // Action: Close iOS instructions
  const handleCloseIosPrompt = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem("pwa-ios-dismissed", "true");
    }
    setShowIosPrompt(false);
  };

  // Action: Reload app for updates
  const handleReloadApp = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <>
      {/* 1. Android / Desktop Install Banner */}
      {showAndroidInstallBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-lg bg-[#111217] border border-orange-500/40 rounded-xl p-4 shadow-2xl z-50 animate-slideUp font-sans">
          <div className="flex gap-4">
            <img 
              src={SERVITIUM_LOGO_BASE64} 
              alt="Servitium logo" 
              className="w-14 h-14 rounded-lg bg-[#090a0f] p-1 border border-[#1e2029] object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-black tracking-wider text-[#f8fafc] uppercase">Instalar Servitium</h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Adicione o Servitium à sua tela inicial para acesso instantâneo off-line, lançamentos mais rápidos e desempenho aprimorado.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Instalar
                </button>
                <button
                  type="button"
                  onClick={handleDeclineAndroidPrompt}
                  className="bg-transparent hover:bg-[#1c1d27] text-slate-400 hover:text-slate-200 font-bold text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-md transition-all cursor-pointer"
                >
                  Agora não
                </button>
              </div>
            </div>
            <button 
              type="button"
              onClick={handleDeclineAndroidPrompt}
              className="text-slate-500 hover:text-slate-300 self-start p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. iOS Installation Modal */}
      {showIosPrompt && (
        <div className="fixed inset-0 bg-[#090a0f]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-[#111217] border border-[#1e2029] rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button 
              type="button"
              onClick={() => handleCloseIosPrompt(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <img 
                src={SERVITIUM_LOGO_BASE64} 
                alt="Servitium logo" 
                className="w-16 h-16 mx-auto rounded-xl bg-[#090a0f] p-1.5 border border-orange-500/20 object-contain mb-3"
                referrerPolicy="no-referrer"
              />
              <h3 className="text-sm font-bold text-[#f8fafc] uppercase tracking-wider">Instalar no seu iPhone</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Acesse o aplicativo com um único toque direto da sua tela inicial.
              </p>
            </div>

            <div className="mt-5 space-y-3.5 border-t border-[#1e2029] pt-4 text-left">
              {/* Step 1 */}
              <div className="flex gap-3 items-start">
                <div className="bg-orange-500/10 text-orange-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-orange-500/20 shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-slate-300 leading-normal">
                  Toque no botão de <strong>Compartilhar</strong> na barra do Safari abaixo.
                  <div className="flex items-center gap-1.5 mt-1 bg-[#181921] px-2.5 py-1.5 rounded border border-[#262836] w-fit text-[10px] font-mono text-orange-400">
                    <Share2 className="w-3.5 h-3.5" /> Compartilhar
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 items-start">
                <div className="bg-orange-500/10 text-orange-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-orange-500/20 shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-slate-300 leading-normal">
                  Role a lista para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
                  <div className="flex items-center gap-1.5 mt-1 bg-[#181921] px-2.5 py-1.5 rounded border border-[#262836] w-fit text-[10px] font-mono text-orange-400">
                    <PlusSquare className="w-3.5 h-3.5" /> Adicionar à Tela de Início
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 items-start">
                <div className="bg-orange-500/10 text-orange-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-orange-500/20 shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs text-slate-300 leading-normal">
                  Confirme tocando em <strong>Adicionar</strong> no canto superior direito.
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleCloseIosPrompt(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors uppercase tracking-wider"
              >
                Entendi
              </button>
              <button
                type="button"
                onClick={() => handleCloseIosPrompt(true)}
                className="text-[10px] text-slate-500 hover:text-slate-400 py-1 transition-colors underline cursor-pointer"
              >
                Não mostrar novamente no iPhone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Service Worker Version Update Alert */}
      {newVersionAvailable && (
        <div className="fixed bottom-16 right-4 z-50 max-w-sm bg-[#111217] border border-orange-500/50 rounded-xl p-4 shadow-2xl animate-slideUp font-sans">
          <div className="flex gap-3 items-start">
            <div className="bg-orange-500/10 p-1.5 rounded text-orange-400 border border-orange-500/20 mt-0.5">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Nova Versão Disponível</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Uma atualização de produção foi baixada. Deseja reiniciar para carregar as novas funcionalidades e ajustes de folha?
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleReloadApp}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[9px] uppercase tracking-wide px-3 py-1.5 rounded-md transition-all cursor-pointer"
                >
                  Atualizar Agora
                </button>
                <button
                  type="button"
                  onClick={() => setNewVersionAvailable(false)}
                  className="bg-transparent hover:bg-[#1c1d27] text-slate-400 font-bold text-[9px] uppercase tracking-wide px-3 py-1.5 rounded-md transition-all cursor-pointer"
                >
                  Depois
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Connection State Toast Notifications */}
      {showConnectionToast && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-lg border shadow-lg bg-[#111217] text-white text-[10px] font-sans font-bold animate-slideUp">
          {connectionType === "online" ? (
            <>
              <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full border border-emerald-500/30">
                <Wifi className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[#f8fafc]">Conexão Restabelecida</span>
                <p className="text-[8px] text-slate-500 font-normal font-mono mt-0.5">SISTEMA RE-SINCROINIZADO ONLINE</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-rose-500/20 text-rose-400 p-1 rounded-full border border-rose-500/30">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <span className="text-[#f8fafc]">Modo Off-line Ativo</span>
                <p className="text-[8px] text-slate-500 font-normal font-mono mt-0.5">DADOS SEGUROS NO ARMAZENAMENTO LOCAL</p>
              </div>
            </>
          )}
          {connectionType === "offline" && (
            <button 
              type="button"
              onClick={() => setShowConnectionToast(false)}
              className="text-slate-500 hover:text-slate-300 pl-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
