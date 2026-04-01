import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import StudentLayout from './pages/student/StudentLayout';
import StudentHome from './pages/student/StudentHome';
import QuizTestList from './pages/student/QuizTestList';
import CodeArenaList from './pages/student/CodeArenaList';
import TestRunner from './pages/student/TestRunner';
import AdminLayout from './pages/admin/AdminLayout';
import AdminHome from './pages/admin/AdminHome';
import CreateTest from './pages/admin/CreateTest';
import Performance from './pages/admin/Performance';
import OnboardStudent from './pages/admin/OnboardStudent';
import ManageStudents from './pages/admin/ManageStudents';
import UploadDocuments from './pages/admin/UploadDocuments';
import ViewDocuments from './pages/student/ViewDocuments';
import ManageTests from './pages/admin/ManageTests';
import './index.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Student Portal Routes */}
        <Route path="/student" element={<StudentLayout />}>
           <Route index element={<StudentHome />} />
           <Route path="quiz" element={<QuizTestList />} />
           <Route path="code" element={<CodeArenaList />} />
           <Route path="documents" element={<ViewDocuments />} />
        </Route>

        {/* Fullscreen Test Routes (No Navbar) */}
        <Route path="/student/take-quiz/:id" element={<TestRunner />} />
        <Route path="/student/take-code/:id" element={<TestRunner />} />

        {/* Admin Portal Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="create-test" element={<CreateTest />} />
          <Route path="manage-tests" element={<ManageTests />} />
          <Route path="performance" element={<Performance />} />
          <Route path="onboard" element={<OnboardStudent />} />
          <Route path="manage-students" element={<ManageStudents />} />
          <Route path="upload-documents" element={<UploadDocuments />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
