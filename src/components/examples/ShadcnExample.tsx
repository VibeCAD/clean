import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { PlusIcon, BoxIcon, TrashIcon } from 'lucide-react';

interface ShadcnExampleProps {
  onCreatePrimitive?: (type: string, name: string) => void;
  onDeleteSelected?: () => void;
  selectedCount?: number;
}

export const ShadcnExample: React.FC<ShadcnExampleProps> = ({
  onCreatePrimitive,
  onDeleteSelected,
  selectedCount = 0
}) => {
  const [objectName, setObjectName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleCreateObject = () => {
    if (objectName.trim() && onCreatePrimitive) {
      onCreatePrimitive('cube', objectName.trim());
      setObjectName('');
      setIsOpen(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>shadcn/ui Integration Example</CardTitle>
          <CardDescription>
            This demonstrates how to use shadcn/ui components in VibeCad Pro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Button variants */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="default">Default Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
          </div>

          {/* Button sizes */}
          <div className="flex gap-2 items-center">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <BoxIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Input example */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Object Name</label>
            <Input
              placeholder="Enter object name..."
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
            />
          </div>

          {/* Dialog example */}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create New Object
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Object</DialogTitle>
                <DialogDescription>
                  Enter a name for your new 3D object. It will be created as a cube.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Object name..."
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateObject()}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateObject} disabled={!objectName.trim()}>
                    Create Object
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              onClick={onDeleteSelected}
              disabled={selectedCount === 0}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Selected ({selectedCount})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShadcnExample; 