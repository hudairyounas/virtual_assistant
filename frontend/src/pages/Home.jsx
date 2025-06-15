import React, { useContext, useEffect, useRef, useState } from "react";
import { userDataContext } from "../context/userContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import aiImg from "../assets/ai.gif";
import userImg from "../assets/user.gif";
import { FaBars } from "react-icons/fa"; // Hamburger Icon

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } =
    useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState([]);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const synth = window.speechSynthesis;

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, {
        withCredentials: true,
      });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.log(error);
    }
  };

  const initializeSpeech = () => {
    synth.speak(new SpeechSynthesisUtterance(""));
    startRecognition();
    setIsInitialized(true);
  };

  const startRecognition = () => {
    try {
      recognitionRef.current?.start();
      setListening(true);
    } catch (error) {
      if (!error.message.includes("start")) {
        console.log("Recognition error:", error);
      }
    }
  };

  const speak = (text) => {
    if (!text || typeof text !== "string") return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    const voices = synth.getVoices();
    utterance.voice =
      voices.find((voice) => voice.lang === "en-US") || voices[0];

    utterance.onend = () => {
      setAiText("");
      isSpeakingRef.current = false;
      setTimeout(() => {
        startRecognition();
      }, 800);
      synth.cancel();
      synth.speak(utterance);
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      startRecognition();
    };

    isSpeakingRef.current = true;
    synth.cancel();
    synth.speak(utterance);
  };

  const handleCommand = (data) => {
    const { type, userInput, response } = data;
    setHistory((prev) => [...prev, { userInput, response }]);
    speak(response);
    if (type === "google-search") {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(userInput)}`,
        "_blank"
      );
    }
    if (type === "calculator-open") {
      window.open(`https://www.google.com/search?q=calculator`);
    }
    if (type === "instagram-open") {
      window.open(`https://www.instagram.com`, "_blank");
    }
    if (type === "facebook-open") {
      window.open(`https://www.facebook.com`, "_blank");
    }
    if (type === "weather-show") {
      window.open(`https://www.google.com/search?q=weather`, "_blank");
    }
    if (type === "youtube-search" || type === "youtube-play") {
      window.open(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
          userInput
        )}`,
        "_blank"
      );
    }
  };

  useEffect(() => {
    if (!window.speechSynthesis) {
      console.error("SpeechSynthesis not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    let isMounted = true;

    const safeRecognition = () => {
      if (isMounted && !isSpeakingRef.current && !isRecognizingRef.current) {
        try {
          recognition.start();
        } catch (err) {
          if (err.name !== "InvalidStateError") {
            console.log("Start error:", err);
          }
        }
      }
    };

    const loadVoices = () => {
      const voices = synth.getVoices();
      if (!voices.length) {
        setTimeout(loadVoices, 100);
      }
    };

    synth.onvoiceschanged = loadVoices;
    loadVoices();

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      setListening(true);
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      setListening(false);
      if (!isSpeakingRef.current) {
        setTimeout(safeRecognition, 1000);
      }
    };

    recognition.onerror = (event) => {
      isRecognizingRef.current = false;
      setListening(false);
      if (event.error !== "aborted" && isMounted && !isSpeakingRef.current) {
        setTimeout(safeRecognition, 1000);
      }
    };

    recognition.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      if (
        transcript.toLowerCase().includes(userData.assistantName.toLowerCase())
      ) {
        setUserText(transcript);
        recognition.stop();
        isRecognizingRef.current = false;
        setListening(false);
        const data = await getGeminiResponse(transcript);
        handleCommand(data);
        setAiText(data.response);
      }
    };

    const fallback = setInterval(() => {
      if (!isSpeakingRef.current && !isRecognizingRef.current) {
        safeRecognition();
      }
    }, 10000);

    return () => {
      recognition.stop();
      setListening(false);
      isRecognizingRef.current = false;
      clearInterval(fallback);
      synth.cancel();
      synth.onvoiceschanged = null;
    };
  }, [userData.assistantName, getGeminiResponse]);

  return (
    <div className="w-full h-full min-h-screen bg-gradient-to-t from-black to-[#030353] flex flex-col items-center p-4 relative">
      {/* Hamburger Menu */}
      <div className="absolute top-5 left-5 z-50">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white text-2xl"
        >
          <FaBars className="text-black cursor-pointer" />
        </button>
      </div>

      {/* Menu (Mobile Drawer Style) */}
      {menuOpen && (
        <div className="absolute top-0 left-0 h-full bg-white shadow-md z-40 flex flex-col p-4 gap-4">
          <div className="pt-10 w-[200px] flex flex-col items-start gap-y-3">
            <button
              onClick={handleLogOut}
              className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer"
            >
              Log Out
            </button>
            <button
              onClick={() => navigate("/customize")}
              className="bg-green-500 text-white px-4 py-2 rounded cursor-pointer"
            >
              Customize Assistant
            </button>
            <button
              onClick={() => setHistoryVisible(!historyVisible)}
              className="bg-purple-500 text-white px-4 py-2 rounded cursor-pointer"
            >
              {historyVisible ? "Hide History" : "Show History"}
            </button>
          </div>
        </div>
      )}

      {/* Assistant Panel */}
      <div className="flex flex-col items-center gap-4 mt-20 w-full max-w-sm">
        {!isInitialized && (
          <button
            onClick={initializeSpeech}
            className="min-w-[150px] h-[50px] bg-white text-black font-semibold rounded-full text-[17px] cursor-pointer"
          >
            Start Assistant
          </button>
        )}

        <div className="w-full max-w-[300px] h-[400px] rounded-2xl overflow-hidden shadow-md">
          <img
            src={userData?.assistantImage}
            alt="Assistant"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-white text-lg font-semibold">
          I'm {userData?.assistantName}
        </h1>

        {aiText ? (
          <img src={aiImg} alt="AI Responding" className="w-[200px]" />
        ) : (
          <img src={userImg} alt="Listening" className="w-[200px]" />
        )}

        <p className="text-white text-center text-[16px] font-semibold break-words px-4">
          {userText || aiText}
        </p>
      </div>

      {/* History Section */}
      {historyVisible && (
        <div className="w-full max-w-md mt-6 bg-white rounded-lg shadow-lg p-4 overflow-y-auto max-h-[300px]">
          <h2 className="text-xl font-bold mb-2">Interaction History</h2>
          <ul className="space-y-2">
            {userData.history.map((item, index) => (
              <li key={index} className="bg-gray-100 p-2 rounded">
                <strong>You:</strong> {item.userInput}
                <br />
                <strong>{userData?.assistantName}:</strong> {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Home;
