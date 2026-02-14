type SpeechRecognitionType = typeof window.SpeechRecognition | typeof window.webkitSpeechRecognition;

const getRecognition = () => {
  const SpeechRecognition =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionType }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionType }).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
};

export const startSpeechRecognition = () =>
  new Promise<string>((resolve, reject) => {
    const recognition = getRecognition();
    if (!recognition) {
      reject(new Error("Speech recognition unavailable"));
      return;
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = () => {
      reject(new Error("Speech recognition error"));
    };

    recognition.start();
  });

const getVoices = () => {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const handler = () => {
      const nextVoices = synth.getVoices();
      if (nextVoices.length) {
        synth.removeEventListener("voiceschanged", handler);
        resolve(nextVoices);
      }
    };
    synth.addEventListener("voiceschanged", handler);
  });
};

export const speakText = async (text: string, onEnd?: () => void) => {
  if (!("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;
  const voices = await getVoices();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const preferred = voices.find((voice) => voice.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      onEnd?.();
      resolve();
    };
    synth.cancel();
    synth.speak(utterance);
  });
};

export const stopSpeaking = () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};
