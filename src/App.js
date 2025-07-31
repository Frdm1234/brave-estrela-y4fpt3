
// App.js with NOTE default mode, fixed persistent note deletion, and calendar limited to month view
import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./App.css";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  deleteField,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6axNqbBJuGzNgjQrGYZQe3AJ2-h5earM",
  authDomain: "coparentcal-2f437.firebaseapp.com",
  projectId: "coparentcal-2f437",
  storageBucket: "coparentcal-2f437.appspot.com",
  messagingSenderId: "926733966843",
  appId: "1:926733966843:web:1bc51534f7135beb6b3f5e",
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

function App() {
  const [assignments, setAssignments] = useState({});
  const [entries, setEntries] = useState([]);
  const [activeMode, setActiveMode] = useState("note"); // Default to note
  const [lastClicked, setLastClicked] = useState(null);
  const [viewedDate, setViewedDate] = useState(new Date());
  const [noteModalDate, setNoteModalDate] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "calendar", "shared"), (snap) => {
      setActiveMode("note"); // force NOTE mode on load
      const data = snap.data();
      if (data) {
        setAssignments(data.assignments || {});
        setEntries(data.info || []);
      } else {
        setAssignments({});
        setEntries([]);
      }
    });
    return () => unsub();
  }, []);

  const persistData = (newAssignments = assignments, newEntries = entries) => {
    setDoc(
      doc(db, "calendar", "shared"),
      { assignments: newAssignments, info: newEntries },
      { merge: true }
    );
  };

  const getEffectiveAssignment = (date) => {
    const dStr = date.toDateString();
    const data = assignments[dStr];
    if (typeof data === "object" && data.owner) return data.owner;
    const day = date.getDay();
    return day >= 1 && day <= 3 ? "joe" : "amber";
  };

  const toggleDate = (date, isRange = false) => {
    const dateStr = date.toDateString();
    const newAssignments = { ...assignments };

    if (activeMode === "note") {
      setNoteModalDate(date);
      setNoteText(assignments[dateStr]?.note || "");
      setIsEditingNote(!assignments[dateStr]?.note);
      return;
    }

    if (!isRange) {
      if (activeMode === "ollie") {
        const prev = newAssignments[dateStr] || {};
        newAssignments[dateStr] = { ...prev, ollie: !prev.ollie };
      } else {
        if (newAssignments[dateStr]?.owner === activeMode) {
          delete newAssignments[dateStr].owner;
          if (!newAssignments[dateStr].note && !newAssignments[dateStr].ollie)
            delete newAssignments[dateStr];
        } else {
          newAssignments[dateStr] = {
            ...newAssignments[dateStr],
            owner: activeMode,
          };
        }
      }
      setLastClicked(date);
    } else {
      if (!lastClicked) return toggleDate(date, false);
      const [start, end] =
        lastClicked < date ? [lastClicked, date] : [date, lastClicked];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dStr = new Date(d).toDateString();
        if (activeMode === "ollie") {
          const prev = newAssignments[dStr] || {};
          newAssignments[dStr] = { ...prev, ollie: true };
        } else {
          newAssignments[dStr] = {
            ...newAssignments[dStr],
            owner: activeMode,
          };
        }
      }
    }

    setAssignments(newAssignments);
    persistData(newAssignments, entries);
  };

  const tileClassName = ({ date }) => {
    const dStr = date.toDateString();
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);

    const prevAssigned = getEffectiveAssignment(prev);
    const currAssigned = getEffectiveAssignment(date);
    const nextAssigned = getEffectiveAssignment(next);

    let className = "";
    if (currAssigned === "joe") {
      className =
        nextAssigned === "amber" ? "transition-blue-pink" : "joe-date";
    } else if (currAssigned === "amber") {
      className =
        nextAssigned === "joe" ? "transition-pink-blue" : "amber-date";
    }

    const isOllie = assignments[dStr]?.ollie;
    if (isOllie) {
      const prevOllie = assignments[prev.toDateString()]?.ollie;
      const nextOllie = assignments[next.toDateString()]?.ollie;
      if (prevOllie && nextOllie) className += " ollie-indicator ollie-full";
      else if (!prevOllie && nextOllie)
        className += " ollie-indicator ollie-start";
      else if (prevOllie && !nextOllie)
        className += " ollie-indicator ollie-end";
      else className += " ollie-indicator ollie-solo";
    }
    return className;
  };

  const saveNote = () => {
    const dateStr = noteModalDate.toDateString();
    const newAssignments = {
      ...assignments,
      [dateStr]: {
        ...assignments[dateStr],
        note: noteText,
      },
    };
    setAssignments(newAssignments);
    persistData(newAssignments, entries);
    setNoteModalDate(null);
    setNoteText("");
    setIsEditingNote(false);
  };

  const deleteNote = async () => {
    const dateStr = noteModalDate.toDateString();
    const calendarRef = doc(db, "calendar", "shared");
    const current = assignments[dateStr] || {};
    const hasOwner = !!current.owner;
    const hasOllie = !!current.ollie;

    if (!hasOwner && !hasOllie) {
      await setDoc(
        calendarRef,
        {
          [`assignments.${dateStr}`]: deleteField(),
        },
        { merge: true }
      );
    } else {
      await setDoc(
        calendarRef,
        {
          [`assignments.${dateStr}.note`]: deleteField(),
        },
        { merge: true }
      );
    }

    const updatedAssignments = { ...assignments };
    if (hasOwner || hasOllie) {
      updatedAssignments[dateStr] = { ...current };
      delete updatedAssignments[dateStr].note;
    } else {
      delete updatedAssignments[dateStr];
    }
    setAssignments(updatedAssignments);
    setNoteModalDate(null);
    setNoteText("");
    setIsEditingNote(false);
  };

  const handleActiveStartDateChange = ({ activeStartDate }) => {
    setViewedDate(activeStartDate);
  };

  const saveEntries = (updatedEntries) => {
    setEntries(updatedEntries);
    persistData(assignments, updatedEntries);
  };

  return (
    <div className="app-container">
      <img src="CPC logo.jpg" alt="Logo" className="app-logo" />
      <div className="toggle-buttons">
        <button className={activeMode === "joe" ? "selected" : ""} onClick={() => setActiveMode("joe")}>Joe</button>
        <button className={activeMode === "amber" ? "selected" : ""} onClick={() => setActiveMode("amber")}>Amber</button>
        <button className={activeMode === "note" ? "selected" : ""} onClick={() => setActiveMode("note")}>Note</button>
        <button className={activeMode === "ollie" ? "selected" : ""} onClick={() => setActiveMode("ollie")}>Ollie</button>
      </div>
      <Calendar
        calendarType="gregory"
        showNeighboringMonth={false}
        activeStartDate={viewedDate}
        onClickDay={(date, e) => toggleDate(date, e.shiftKey)}
        onActiveStartDateChange={handleActiveStartDateChange}
        tileClassName={tileClassName}
        view="month"
        maxDetail="month"
        minDetail="month"
        tileContent={({ date }) =>
          assignments[date.toDateString()]?.note ? (
            <span role="img" aria-label="note">📝</span>
          ) : null
        }
      />
    </div>
  );
}

export default App;