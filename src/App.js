import TextEditor from "./TextEditor";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { v4 as uuidV4 } from "uuid";

function App() {
  return (
    <div>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to={`/editor/${uuidV4()}`} />} />
          <Route path="/editor/:id" element={<TextEditor />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
