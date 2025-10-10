import React, { useState } from 'react';
import { Model } from '../types';
import { Button, Input, Spinner } from './common';

// --- START: Model Creation Form Constants ---
const GENDERS = ['Male', 'Female'];
const ETHNICITIES = ['Caucasian', 'Asian', 'Hispanic', 'African', 'Middle Eastern', 'South Asian'];
const AGE_APPEARANCES = ["Teens", "20s", "30s", "40s", "50s+"];
const SKIN_TONES = ['Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'];
const HAIR_COLORS = ['Blonde', 'Brown', 'Black', 'Red', 'Grey', 'Other'];
const BODY_SHAPES = ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus-size'];
const HAIR_STYLES = ['Short', 'Medium', 'Long', 'Curly', 'Straight', 'Wavy', 'Bald'];
const FACIAL_HAIRS = ['None', 'Stubble', 'Beard', 'Goatee', 'Mustache'];
const HEIGHTS = ["< 160 cm", "160-165 cm", "166-170 cm", "171-175 cm", "176-180 cm", "181-185 cm", "186-190 cm", "> 190 cm"];
// --- END: Model Creation Form Constants ---

interface ModelCreationFormProps {
    onClose: () => void;
    isCreating: boolean;
    onCreateFromScratch: (formData: Omit<Model, 'imageUrl' | 'id'>) => Promise<void>;
    onCreateFromPhoto: (photo: File, name: string) => Promise<void>;
}

const ModelCreationForm: React.FC<ModelCreationFormProps> = ({ onClose, isCreating, onCreateFromScratch, onCreateFromPhoto }) => {
    const [creationMode, setCreationMode] = useState<'scratch' | 'photo'>('scratch');
    const [formData, setFormData] = useState<Omit<Model, 'imageUrl' | 'id'>>({
        name: '',
        gender: 'Female',
        ethnicity: 'Caucasian',
        ageAppearance: '20s',
        height: '171-175 cm',
        skinTone: 'Fair',
        hairColor: 'Brown',
        bodyShape: 'Slim',
        hairStyle: 'Long',
        facialHair: 'None',
    });
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoName, setPhotoName] = useState('');
    const [error, setError] = useState('');

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPhoto(e.target.files[0]);
            setError('');
        }
    };

    const handleSubmitFromScratch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await onCreateFromScratch(formData);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to create model.');
        }
    };

    const handleSubmitFromPhoto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo) {
            setError('Please upload a photo.');
            return;
        }
        setError('');
        try {
            await onCreateFromPhoto(photo, photoName);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to create model from photo.');
        }
    };

    const renderSelect = (name: keyof typeof formData, label: string, options: string[]) => (
        <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{label}</label>
            <select
                name={name}
                // FIX: Simplified the value access. With `types.ts` present, TypeScript can correctly infer
                // that `formData[name]` is a string (or a string literal union), which is a valid type
                // for the `value` attribute of a select element. The previous complex casting is no longer needed.
                value={formData[name]}
                onChange={handleFormChange}
                disabled={isCreating}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
            >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    return (
        <div>
            <div className="border-b border-zinc-200 dark:border-zinc-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setCreationMode('scratch')} className={`${creationMode === 'scratch' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                        Create from Scratch
                    </button>
                    <button onClick={() => setCreationMode('photo')} className={`${creationMode === 'photo' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                        Create from Photo
                    </button>
                </nav>
            </div>

            {creationMode === 'scratch' ? (
                <form onSubmit={handleSubmitFromScratch}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name (Optional)</label>
                            <Input name="name" value={formData.name} onChange={handleFormChange} placeholder="e.g., Alex Doe" disabled={isCreating} />
                        </div>
                        {renderSelect('gender', 'Gender', GENDERS)}
                        {renderSelect('ethnicity', 'Ethnicity', ETHNICITIES)}
                        {renderSelect('ageAppearance', 'Apparent Age', AGE_APPEARANCES)}
                        {renderSelect('height', 'Height', HEIGHTS)}
                        {renderSelect('skinTone', 'Skin Tone', SKIN_TONES)}
                        {renderSelect('hairColor', 'Hair Color', HAIR_COLORS)}
                        {renderSelect('hairStyle', 'Hair Style', HAIR_STYLES)}
                        {renderSelect('bodyShape', 'Body Shape', BODY_SHAPES)}
                        {formData.gender === 'Male' && renderSelect('facialHair', 'Facial Hair', FACIAL_HAIRS)}
                    </div>
                    {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
                    <div className="mt-6 flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isCreating}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={isCreating}>
                            {isCreating && <Spinner />} {isCreating ? 'Creating...' : 'Create Model'}
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleSubmitFromPhoto}>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Upload a full-body photo of a person. The AI will generate a new model with a consistent bodysuit based on the person's appearance.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name (Optional)</label>
                            <Input value={photoName} onChange={(e) => setPhotoName(e.target.value)} placeholder="Assign a name to the new model" disabled={isCreating} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Photo</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} disabled={isCreating} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-700 dark:file:text-zinc-200 dark:hover:file:bg-zinc-600"/>
                            {photo && <p className="text-xs text-zinc-500 mt-1">Selected: {photo.name}</p>}
                        </div>
                    </div>
                    {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
                    <div className="mt-6 flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isCreating}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={isCreating || !photo}>
                             {isCreating && <Spinner />} {isCreating ? 'Creating...' : 'Create Model'}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default ModelCreationForm;