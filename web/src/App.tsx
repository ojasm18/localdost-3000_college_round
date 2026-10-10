import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { NewScan } from './pages/NewScan';
import { IssuesList } from './pages/IssuesList';
import { IssueDetail } from './pages/IssueDetail';
import { VisualEditor } from './pages/VisualEditor';
import { PatchesList } from './pages/PatchesList';
import { PatchDetail } from './pages/PatchDetail';
import { ConflictDetail } from './pages/ConflictDetail';
import { PatchHealth } from './pages/PatchHealth';
import { TestRuns } from './pages/TestRuns';
import { TestRunDetail } from './pages/TestRunDetail';
import { Releases } from './pages/Releases';
import { Activity } from './pages/Activity';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="scan" element={<NewScan />} />
          <Route path="issues" element={<IssuesList />} />
          <Route path="issues/:id" element={<IssueDetail />} />
          <Route path="editor" element={<VisualEditor />} />
          <Route path="patches" element={<PatchesList />} />
          <Route path="patches/:id" element={<PatchDetail />} />
          <Route path="conflicts/:id" element={<ConflictDetail />} />
          <Route path="health" element={<PatchHealth />} />
          <Route path="test-runs" element={<TestRuns />} />
          <Route path="test-runs/:id" element={<TestRunDetail />} />
          <Route path="releases" element={<Releases />} />
          <Route path="activity" element={<Activity />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
