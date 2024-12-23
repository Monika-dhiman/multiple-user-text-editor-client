import React, { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import QuillCursors from "quill-cursors";

Quill.register("modules/cursors", QuillCursors);

const TextEditor = () => {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const [cursors, setCursors] = useState(null);

  const SAVE_INTERVAL_MS = 2000;

  useEffect(() => {
    const socketConnection = io("http://192.168.1.44:8080");
    setSocket(socketConnection);
    socketConnection.on("connect", () => {
      console.log("connected");
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!quill || !socket) return;

    socket.once("load-document", (document) => {
      console.log("load-document", document);
      quill.setContents(document);
      quill.enable();
    });
    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  useEffect(() => {
    if (!quill || !socket) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS); // Save every 2 seconds

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (!quill || !socket) return;
    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };
    quill.on("text-change", handler);

    return () => {
      quill.off("text-change", handler);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (!quill || !socket) return;
    const handler = (delta) => {
      quill.updateContents(delta);
    };
    socket.on("receive-changes", handler);

    return () => {
      socket.off("receive-changes", handler);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (!quill || !socket) return;

    socket.on("update-cursors", (activeUsers) => {
      Object.keys(activeUsers).forEach((id) => {
        if (id !== socket.id) {
          cursors.createCursor(id, activeUsers[id].name, activeUsers[id].color);
          cursors.moveCursor(id, activeUsers[id].cursor);
        }
      });
    });

    socket.on("user-connected", (user) => {
      if (user.id !== socket.id) {
        cursors.createCursor(user.id, user.name, user.color);
      }
    });

    socket.on("cursor-updated", ({ id, cursor }) => {
      if (id !== socket.id) {
        cursors.moveCursor(id, cursor);
      }
    });

    socket.on("user-disconnected", (id) => {
      cursors.removeCursor(id);
    });

    return () => {
      socket.off("update-cursors");
      socket.off("user-connected");
      socket.off("cursor-updated");
      socket.off("user-disconnected");
    };
  }, [socket, quill, cursors]);

  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;

    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);

    const quillInstance = new Quill(editor, {
      theme: "snow",
      modules: {
        cursors: true,
      },
    });
    quillInstance.disable();
    quillInstance.setText("Loading...");
    setQuill(quillInstance);

    const cursorsInstance = quillInstance.getModule("cursors");
    setCursors(cursorsInstance);
  }, []);

  // Send cursor updates
  useEffect(() => {
    if (!quill || !socket) return;

    const handler = (range) => {
      socket.emit("update-cursor", range);
    };

    quill.on("selection-change", handler);

    return () => {
      quill.off("selection-change", handler);
    };
  }, [socket, quill]);

  return <div id="container" ref={wrapperRef}></div>;
};

export default TextEditor;
