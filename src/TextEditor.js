import React, { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import QuillCursors from "quill-cursors";
import { throttle } from "lodash";

Quill.register("modules/cursors", QuillCursors);

const SERVER_CONNECTION_URL =
  process.env.REACT_APP_SERVER_URL || "http://localhost:8080";
const SAVE_INTERVAL_MS = 2000;

const useSocket = (socket, quill, cursors) => {
  useEffect(() => {
    if (!socket || !quill || !cursors) return;

    const initializeSocketEvents = () => {
      socket.on("load-document", (document) => {
        quill.setContents(document);
        quill.enable();
      });

      socket.on("receive-changes", (delta) => {
        quill.updateContents(delta);
      });

      socket.on("update-cursors", (activeUsers) => {
        Object.keys(activeUsers).forEach((id) => {
          if (id !== socket.id) {
            cursors.createCursor(
              id,
              activeUsers[id].name,
              activeUsers[id].color
            );
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
    };

    initializeSocketEvents();

    return () => {
      socket.off("load-document");
      socket.off("receive-changes");
      socket.off("update-cursors");
      socket.off("user-connected");
      socket.off("cursor-updated");
      socket.off("user-disconnected");
    };
  }, [socket, quill, cursors]);
};

const TextEditor = () => {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const [cursors, setCursors] = useState(null);

  useEffect(() => {
    const socketConnection = io(SERVER_CONNECTION_URL);
    setSocket(socketConnection);

    socketConnection.on("connect", () => {
      console.log("Connected to server");
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!quill || !socket) return;

    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  useEffect(() => {
    if (!quill || !socket) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill]);

  useEffect(() => {
    if (!quill || !socket) return;

    const textChangeHandler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", textChangeHandler);

    return () => {
      quill.off("text-change", textChangeHandler);
    };
  }, [socket, quill]);

  useEffect(() => {
    if (!quill || !socket) return;

    const selectionChangeHandler = throttle((range) => {
      if (range) {
        socket.emit("update-cursor", range);
      }
    }, 200);

    quill.on("selection-change", selectionChangeHandler);

    return () => {
      quill.off("selection-change", selectionChangeHandler);
    };
  }, [socket, quill]);

  useSocket(socket, quill, cursors);

  const wrapperRef = useCallback(
    (wrapper) => {
      if (!wrapper || quill) return;

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
    },
    [quill]
  );

  return <div id="container" ref={wrapperRef}></div>;
};

export default TextEditor;
