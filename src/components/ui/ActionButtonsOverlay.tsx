import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Download, Box } from "lucide-react";
import { useSceneStore } from '../../state/sceneStore';

interface ActionButtonsOverlayProps {
  onImport: (file: File) => Promise<void>;
  onExport: () => Promise<void>;
  onCreateCube: () => void;
  sceneInitialized: boolean;
}

export const ActionButtonsOverlay: React.FC<ActionButtonsOverlayProps> = ({ 
  onImport, 
  onExport, 
  onCreateCube,
  sceneInitialized 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    isImporting, 
    sceneObjects, 
    importError 
  } = useSceneStore();

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await onImport(file);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const objectCount = sceneObjects.filter(obj => obj.type !== 'ground').length;
  const isExportDisabled = !sceneInitialized || objectCount === 0;

  return (
    <div className="fixed top-4 right-48 z-50 flex gap-2 pointer-events-auto">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.stl,.obj"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      {/* Test Cube Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onCreateCube}
        disabled={!sceneInitialized}
        className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600 shadow-lg"
        title="🧪 Add Test Cube"
      >
        <Box className="h-4 w-4" />
      </Button>
      
      {/* Import Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleImportClick}
        disabled={!sceneInitialized || isImporting}
        className="bg-white/95 hover:bg-white border-gray-300 shadow-lg"
        title={isImporting ? 'Importing...' : 'Import 3D Model (.glb, .stl, .obj)'}
      >
        {isImporting ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>

      {/* Export Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onExport}
        disabled={isExportDisabled}
        className="bg-white/95 hover:bg-white border-gray-300 shadow-lg"
        title={isExportDisabled ? 'No objects to export' : `Export ${objectCount} object${objectCount !== 1 ? 's' : ''} to STL`}
      >
        <Download className="h-4 w-4" />
      </Button>
      
      {/* Error Display */}
      {importError && (
        <div className="absolute top-12 right-0 bg-red-50 border border-red-200 rounded-md p-2 text-red-700 text-sm shadow-lg max-w-xs">
          Import failed: {importError.message}
        </div>
      )}
    </div>
  );
}; 