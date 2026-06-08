/**
 * RepoGuard
 *
 * Repo selection is recovered asynchronously by RepoLoader/useRepoLoader.
 * The guard intentionally does not redirect to the select-repo page, because
 * doing so can strand startup on the picker before recovery completes.
 */
import React from "react";

interface RepoGuardProps {
  children: React.ReactNode;
}

export const RepoGuard: React.FC<RepoGuardProps> = ({ children }) => {
  return <>{children}</>;
};
