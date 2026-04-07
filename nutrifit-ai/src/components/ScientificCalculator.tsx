import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Delete, Divide, Minus, Plus, X, 
  RotateCcw, Equal, Hash, Percent,
  ChevronLeft
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ScientificCalculatorProps {
  onClose?: () => void;
}

export const ScientificCalculator: React.FC<ScientificCalculatorProps> = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [isScientific, setIsScientific] = useState(true);

  const handleNumber = (num: string) => {
    if (display === '0') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setExpression(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      let result: number;
      const fullExpression = expression + display;
      
      // Basic evaluation for simple operators
      // For a real scientific calculator, we'd use a parser like mathjs
      // But for this implementation, we'll handle common cases
      
      const parts = fullExpression.split(' ');
      if (parts.length === 3) {
        const a = parseFloat(parts[0]);
        const op = parts[1];
        const b = parseFloat(parts[2]);
        
        switch (op) {
          case '+': result = a + b; break;
          case '-': result = a - b; break;
          case '*': result = a * b; break;
          case '/': result = a / b; break;
          case '^': result = Math.pow(a, b); break;
          default: result = b;
        }
        setDisplay(result.toString());
        setExpression('');
      }
    } catch (error) {
      setDisplay('Error');
    }
  };

  const handleScientific = (func: string) => {
    const val = parseFloat(display);
    let result: number;
    
    switch (func) {
      case 'sin': result = Math.sin(val); break;
      case 'cos': result = Math.cos(val); break;
      case 'tan': result = Math.tan(val); break;
      case 'log': result = Math.log10(val); break;
      case 'ln': result = Math.log(val); break;
      case 'sqrt': result = Math.sqrt(val); break;
      case 'exp': result = Math.exp(val); break;
      case 'square': result = val * val; break;
      case 'pi': result = Math.PI; break;
      case 'e': result = Math.E; break;
      case 'percent': result = val / 100; break;
      default: result = val;
    }
    setDisplay(result.toString());
  };

  const clear = () => {
    setDisplay('0');
    setExpression('');
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const Button = ({ 
    children, 
    onClick, 
    className, 
    variant = 'default' 
  }: { 
    children: React.ReactNode, 
    onClick: () => void, 
    className?: string,
    variant?: 'default' | 'operator' | 'scientific' | 'action'
  }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "h-14 rounded-2xl flex items-center justify-center text-lg font-medium transition-all",
        variant === 'default' && "bg-white/5 text-white hover:bg-white/10",
        variant === 'operator' && "bg-brand-green text-black hover:bg-brand-green/90",
        variant === 'scientific' && "bg-white/10 text-brand-green hover:bg-white/20 text-sm",
        variant === 'action' && "bg-white/20 text-white hover:bg-white/30",
        className
      )}
    >
      {children}
    </motion.button>
  );

  return (
    <div className="flex flex-col h-full bg-brand-dark overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full">
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="text-xl font-bold tracking-tight">Scientific Calculator</h2>
        </div>
        <button 
          onClick={() => setIsScientific(!isScientific)}
          className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
            isScientific ? "bg-brand-green text-black" : "bg-white/5 text-white/40"
          )}
        >
          {isScientific ? 'Scientific' : 'Basic'}
        </button>
      </div>

      {/* Display */}
      <div className="flex-1 flex flex-col justify-end p-8 space-y-2">
        <div className="text-right text-white/40 text-sm font-medium h-6 overflow-hidden">
          {expression}
        </div>
        <div className="text-right text-5xl font-bold tracking-tighter text-white overflow-hidden whitespace-nowrap">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="p-6 bg-black/20 rounded-t-[3rem] border-t border-white/5">
        <div className="grid grid-cols-4 gap-3">
          {/* Scientific Row 1 */}
          {isScientific && (
            <>
              <Button onClick={() => handleScientific('sin')} variant="scientific">sin</Button>
              <Button onClick={() => handleScientific('cos')} variant="scientific">cos</Button>
              <Button onClick={() => handleScientific('tan')} variant="scientific">tan</Button>
              <Button onClick={() => handleScientific('sqrt')} variant="scientific">√</Button>
            </>
          )}

          {/* Scientific Row 2 */}
          {isScientific && (
            <>
              <Button onClick={() => handleScientific('log')} variant="scientific">log</Button>
              <Button onClick={() => handleScientific('ln')} variant="scientific">ln</Button>
              <Button onClick={() => handleScientific('exp')} variant="scientific">exp</Button>
              <Button onClick={() => handleOperator('^')} variant="scientific">xʸ</Button>
            </>
          )}

          {/* Scientific Row 3 */}
          {isScientific && (
            <>
              <Button onClick={() => handleScientific('pi')} variant="scientific">π</Button>
              <Button onClick={() => handleScientific('e')} variant="scientific">e</Button>
              <Button onClick={() => handleScientific('square')} variant="scientific">x²</Button>
              <Button onClick={() => handleNumber('.')} variant="scientific">.</Button>
            </>
          )}

          {/* Basic Controls */}
          <Button onClick={clear} variant="action" className="text-brand-green">AC</Button>
          <Button onClick={backspace} variant="action"><Delete size={20} /></Button>
          <Button onClick={() => handleScientific('percent')} variant="action">%</Button>
          <Button onClick={() => handleOperator('/')} variant="operator"><Divide size={20} /></Button>

          <Button onClick={() => handleNumber('7')}>7</Button>
          <Button onClick={() => handleNumber('8')}>8</Button>
          <Button onClick={() => handleNumber('9')}>9</Button>
          <Button onClick={() => handleOperator('*')} variant="operator"><X size={20} /></Button>

          <Button onClick={() => handleNumber('4')}>4</Button>
          <Button onClick={() => handleNumber('5')}>5</Button>
          <Button onClick={() => handleNumber('6')}>6</Button>
          <Button onClick={() => handleOperator('-')} variant="operator"><Minus size={20} /></Button>

          <Button onClick={() => handleNumber('1')}>1</Button>
          <Button onClick={() => handleNumber('2')}>2</Button>
          <Button onClick={() => handleNumber('3')}>3</Button>
          <Button onClick={() => handleOperator('+')} variant="operator"><Plus size={20} /></Button>

          <Button onClick={() => handleNumber('0')} className="col-span-2">0</Button>
          <Button onClick={() => handleNumber('.')}>.</Button>
          <Button onClick={calculate} variant="operator"><Equal size={20} /></Button>
        </div>
      </div>
    </div>
  );
};
