import React, { useState, useEffect } from "react";
import {
  initializeApp
} from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  listAll,
  getDownloadURL,
} from "firebase/storage";

// Firebase config & init
const firebaseConfig = {
  apiKey: "AIzaSyChn3zMNcZ7UlYjfcjv_jkrrwOYN7ppjRY",
  authDomain: "time-table-c99ed.firebaseapp.com",
  projectId: "time-table-c99ed",
  storageBucket: "time-table-c99ed.appspot.com",
  messagingSenderId: "136354987305",
  appId: "1:136354987305:web:422fdc6cec63ec2010cb38",
  measurementId: "G-BJ1G205H4Q",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const lectures = [
  {
    code: "BIO102",
    title: "General Biology II",
    days: ["Tuesday"],
    times: ["09:00–10:00", "10:00–11:00"],
    rooms: ["DLI B", "DLI B"],
    color: "#0F4C75",
  },
  {
    code: "CHM-CM102",
    title: "General Chemistry II",
    days: ["Monday", "Tuesday", "Friday"],
    times: [
      "09:00–10:00",
      "16:00–18:00",
      "10:00–11:00",
      "08:00–09:00"
    ],
    rooms: [
      "DLI A/B/C",
      "DLI A/B/C",
      "DLI A",
      "DLI A/B/C"
    ],
    color: "#3282B8",
  },
  {
    code: "COS102",
    title: "Computer as a Problem-Solving Tool",
    days: ["Monday"],
    times: ["10:00–11:00", "11:00–12:00"],
    rooms: ["LT 009", "LT 009"],
    color: "#BBE1FA",
  },
  {
    code: "LAG-COS106",
    title: "Introduction to Algorithms & Data Structures",
    days: ["Thursday"],
    times: ["11:00–12:00", "12:00–13:00"],
    rooms: ["S006", "S006"],
    color: "#1B262C",
  },
  {
    code: "MTH102",
    title: "Elementary Mathematics II: Calculus",
    days: ["Tuesday", "Wednesday"],
    times: [
      "12:00–13:00",
      "13:00–14:00",
      "11:00–12:00",
      "12:00–13:00",
    ],
    rooms: [
      "DLI A/B/C",
      "DLI A/B",
      "DLI A/B/C",
      "DLI A/B/C",
    ],
    color: "#3282B8",
  },
  {
    code: "PHY-CM102",
    title: "General Physics II",
    days: ["Monday", "Tuesday", "Thursday", "Friday"],
    times: [
      "14:00–15:00",
      "14:00–15:00",
      "14:00–15:00",
      "10:00–11:00",
    ],
    rooms: [
      "DLI A/B/C",
      "DLI A/B/C",
      "DLI A/B/C",
      "DLI A/B/C",
    ],
    color: "#0F4C75",
  },
  {
    code: "STA112",
    title: "Probability I",
    days: ["Monday"],
    times: ["16:00–18:00"],
    rooms: ["DLI A/B/C"],
    color: "#BBE1FA",
  },
  {
    code: "LAG-COS104",
    title: "Introduction to Web Design & Development",
    days: ["Wednesday"],
    times: ["14:00–15:00", "15:00–16:00"],
    rooms: ["E303", "E303"],
    color: "#1B262C",
  },
];

// Days and times (rows)
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeSlots = [
  "08:00–09:00",
  "09:00–10:00",
  "10:00–11:00",
  "11:00–12:00",
  "12:00–13:00",
  "13:00–14:00",
  "14:00–15:00",
  "15:00–16:00",
  "16:00–18:00",
];

function App() {
  const [page, setPage] = useState("home"); // home, schedule, notes
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [notes, setNotes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  // Load lecture notes from Firestore
  useEffect(() => {
    if (page === "notes") {
      fetchNotes();
    }
  }, [page]);

  async function fetchNotes() {
    const notesCol = collection(db, "lectureNotes");
    const notesSnapshot = await getDocs(notesCol);
    const notesList = [];

    for (const docSnap of notesSnapshot.docs) {
      const data = docSnap.data();
      notesList.push({
        id: docSnap.id,
        ...data,
      });
    }
    setNotes(notesList);
  }

  // Upload file to Firebase Storage and save info in Firestore
  async function handleUpload() {
    if (!file || !selectedLecture) {
      setMessage("Select a lecture and a file first!");
      return;
    }
    setUploading(true);
    try {
      const storageRef = ref(storage, `notes/${selectedLecture.code}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // Save metadata to Firestore
      await addDoc(collection(db, "lectureNotes"), {
        courseCode: selectedLecture.code,
        courseTitle: selectedLecture.title,
        fileName: file.name,
        fileURL: url,
        uploadedAt: new Date(),
      });
      setMessage("Upload successful!");
      fetchNotes(); // refresh notes list
    } catch (error) {
      setMessage("Upload failed: " + error.message);
    }
    setUploading(false);
  }

  // Schedule browser notifications 1 hour before lectures today
  useEffect(() => {
    if (page === "schedule") {
      scheduleNotifications();
    }
  }, [page]);

  function scheduleNotifications() {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const todayName = now.toLocaleDateString("en-US", { weekday: "long" });

    lectures.forEach((lec) => {
      if (!lec.days.includes(todayName)) return;

      lec.times.forEach((timeRange, i) => {
        const start = timeRange.split("–")[0]; // e.g., "09:00"
        const [startH, startM] = start.split(":").map(Number);

        const classTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          startH,
          startM
        );
        const reminderTime = new Date(classTime.getTime() - 60 * 60 * 1000); // 1 hr before

        const delay = reminderTime.getTime() - now.getTime();
        if (delay > 0) {
          setTimeout(() => {
            new Notification(`Upcoming Lecture: ${lec.code}`, {
              body: `${lec.title} starts at ${start} in ${lec.rooms[i]}`,
              icon: "/favicon.ico",
            });
          }, delay);
        }
      });
    });
  }

  // Find lecture matching day/time for a cell
  const getLectureAt = (day, timeSlot) => {
    for (const lec of lectures) {
      for (let i = 0; i < lec.days.length; i++) {
        if (lec.days[i] === day) {
          if (lec.times[i] === timeSlot) return { ...lec, timeIndex: i };
        }
      }
    }
    return null;
  };

  // Render timetable table
  const renderTable = () => (
    <table className="timetable">
      <thead>
        <tr>
          <th>Time / Day</th>
          {daysOfWeek.map((day) => (
            <th key={day}>{day}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {timeSlots.map((time) => (
          <tr key={time}>
            <td className="time-slot">{time}</td>
            {daysOfWeek.map((day) => {
              const lec = getLectureAt(day, time);
              if (!lec) return <td key={day}></td>;
              return (
                <td
                  key={day}
                  className="lecture-cell"
                  style={{ backgroundColor: lec.color, color: "#fff", cursor: "pointer" }}
                  onClick={() => setSelectedLecture(lec)}
                  title={`${lec.code} - ${lec.rooms[lec.timeIndex]}`}
                >
                  {lec.code}
                  <br />
                  <small>{lec.rooms[lec.timeIndex]}</small>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Lecture info popup
  const LectureInfo = () =>
    selectedLecture && (
      <div className="lecture-info-overlay" onClick={() => setSelectedLecture(null)}>
        <div
          className="lecture-info"
          onClick={(e) => e.stopPropagation()}
          style={{ borderColor: selectedLecture.color }}
        >
          <h2>{selectedLecture.title}</h2>
          <p><strong>Course Code:</strong> {selectedLecture.code}</p>
          <p><strong>Days:</strong> {selectedLecture.days.join(", ")}</p>
          <p>
            <strong>Times & Rooms:</strong>
            <ul>
              {selectedLecture.times.map((time, idx) => (
                <li key={idx}>
                  {time} - Room: {selectedLecture.rooms[idx]}
                </li>
              ))}
            </ul>
          </p>
          <button onClick={() => {
            scheduleSingleNotification(selectedLecture);
            alert("Reminder set! You'll get a notification 1 hour before each lecture.");
            setSelectedLecture(null);
          }}>
            Set Reminder
          </button>
          <button onClick={() => setSelectedLecture(null)} style={{marginLeft: "10px"}}>
            Close
          </button>
        </div>
      </div>
    );

  // Schedule notifications for a single lecture course
  function scheduleSingleNotification(lec) {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;

    const now = new Date();

    lec.days.forEach((day, idx) => {
      const startTime = lec.times[idx].split("–")[0];
      const [hour, minute] = startTime.split(":").map(Number);

      // Find next date for the given day of week
      const today = now.getDay(); // Sunday = 0 ... Saturday = 6
      const daysMap = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };
      const targetDay = daysMap[day];
      let dayDiff = targetDay - today;
      if (dayDiff < 0) dayDiff += 7; // next week's day if today passed

      const lectureDate = new Date(now);
      lectureDate.setDate(now.getDate() + dayDiff);
      lectureDate.setHours(hour, minute, 0, 0);

      const reminderTime = new Date(lectureDate.getTime() - 60 * 60 * 1000); // 1 hour before
      const delay = reminderTime.getTime() - now.getTime();

      if (delay > 0) {
        setTimeout(() => {
          new Notification(`Upcoming Lecture: ${lec.code}`, {
            body: `${lec.title} starts at ${startTime} in ${lec.rooms[idx]}`,
            icon: "/favicon.ico",
          });
        }, delay);
      }
    });
  }

  return (
    <div className="app-container">
      {page === "home" && (
        <div className="home-page">
          <h1>Made by Platinum</h1>
          <div className="home-buttons">
            <button onClick={() => setPage("schedule")}>View Schedule</button>
            <button onClick={() => setPage("notes")}>Lecture Notes</button>
          </div>
        </div>
      )}

      {page === "schedule" && (
        <>
          <h1>Class Timetable</h1>
          {renderTable()}
          {selectedLecture && <LectureInfo />}
          <button className="back-btn" onClick={() => setPage("home")}>
            Back to Home
          </button>
        </>
      )}

      {page === "notes" && (
        <>
          <h1>Lecture Notes</h1>
          <label>
            Select Lecture:
            <select
              onChange={(e) => {
                const lec = lectures.find((l) => l.code === e.target.value);
                setSelectedLecture(lec);
              }}
              value={selectedLecture ? selectedLecture.code : ""}
            >
              <option value="">--Choose a Lecture--</option>
              {lectures.map((lec) => (
                <option key={lec.code} value={lec.code}>
                  {lec.code} - {lec.title}
                </option>
              ))}
            </select>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Note"}
          </button>
          <p>{message}</p>

          <h2>Available Notes</h2>
          <ul className="notes-list">
            {notes.length === 0 && <p>No notes uploaded yet.</p>}
            {notes.map((note) => (
              <li key={note.id}>
                <strong>{note.courseCode}:</strong> {note.fileName} -{" "}
                <a href={note.fileURL} target="_blank" rel="noreferrer">
                  Download
                </a>
              </li>
            ))}
          </ul>

          <button className="back-btn" onClick={() => setPage("home")}>
            Back to Home
          </button>
        </>
      )}

      <style>{`
        .app-container {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          background-color: #1B262C;
          color: white;
          min-height: 100vh;
        }
        h1 {
          color: #BBE1FA;
          text-align: center;
          margin-bottom: 30px;
        }
        .home-buttons {
          display: flex;
          justify-content: center;
          gap: 20px;
        }
        button {
          background-color: #0F4C75;
          color: white;
          border: none;
          padding: 12px 24px;
          cursor: pointer;
          font-size: 18px;
          border-radius: 5px;
          transition: background-color 0.3s ease;
        }
        button:hover {
          background-color: #3282B8;
        }
        .back-btn {
          margin-top: 30px;
          display: block;
          margin-left: auto;
          margin-right: auto;
          width: 150px;
        }
        table.timetable {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        table.timetable th, table.timetable td {
          border: 1px solid #3282B8;
          padding: 8px;
          text-align: center;
        }
        table.timetable th {
          background-color: #3282B8;
          color: white;
        }
        .time-slot {
          background-color: #0F4C75;
          font-weight: bold;
          width: 110px;
        }
        .lecture-cell {
          font-weight: 700;
          user-select: none;
        }
        .lecture-info-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .lecture-info {
          background-color: #1B262C;
          padding: 25px 30px;
          border-radius: 10px;
          border: 4px solid;
          max-width: 400px;
          color: white;
        }
        .lecture-info h2 {
          margin-top: 0;
          margin-bottom: 15px;
        }
        .lecture-info ul {
          list-style: none;
          padding-left: 0;
        }
        .lecture-info button {
          margin-top: 20px;
          width: 100%;
        }
        label {
          display: block;
          margin-bottom: 10px;
          font-weight: 600;
        }
        select, input[type="file"] {
          margin-bottom: 15px;
          width: 100%;
          padding: 8px;
          border-radius: 5px;
          border: none;
          font-size: 16px;
        }
        .notes-list {
          max-height: 300px;
          overflow-y: auto;
          padding-left: 20px;
        }
        .notes-list li {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}

export default App;
