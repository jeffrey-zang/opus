import React, { useState } from "react";

const App = () => {
  const asciiText = `                                                 ##                                                 
                                              ########                                              
                                              ########                                              
                                             ##########                                             
                                             ##########                                             
                                             ##########                                             
                     ####                    ##########                    ####                     
                   #########                 ##########                 #########                   
                   ##########                ##########                ##########                   
                   ############              ##########              ############                   
                    #############             ########             #############                    
                     ##############           ########           ##############                     
                       ##############                          ##############                       
                         ############                          ############                         
                           ##########                          ##########                           
                             #######                            #######                             
                               ###                                ###                               
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
         ###################                   ########                                             
        #####################                 ##############                                        
        ######################               #####################                                  
        #####################                 #########################                             
         ###################                  ##############################                        
                                               ###################################                  
                                                #######################################             
                                                ##########    #############################         
                                                 #########         #########################        
                               ###               ##########              ###################        
                             #######              ##########             ###################        
                           ##########              #########         #####################          
                         ############              ##########      ####################             
                       ##############               #########     ##################                
                     ##############                 ##########   ###############                    
                    #############                    ########## ############                        
                   ############                       ####################                          
                   ##########                         ###################                           
                   #########                           #################                            
                     ####                               ###############                             
                                                        ##############                              
                                                         ############                               
                                                         ###########                                
                                                          #########                                 
                                                           ########                                 
                                                            #####                                   `;

  const asciiRows = asciiText.split("\n");
  const numRows = asciiRows.length;
  const numCols = Math.max(...asciiRows.map((row) => row.length));

  const paddedRows = asciiRows.map((row) => row.padEnd(numCols, " "));

  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(
    null
  );
  const [ripple, setRipple] = useState<{
    row: number;
    col: number;
    timestamp: number;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const radius = 5;

  const isWithinRadius = (row: number, col: number) => {
    if (!hovered) return false;
    const dr = row - hovered.row;
    const dc = col - hovered.col;

    return (
      (dc * dc) / (1.75 * radius * (1.75 * radius)) +
        (dr * dr) / (radius * radius) <=
      1
    );
  };

  const isWithinRippleRadius = (row: number, col: number) => {
    if (!ripple) return false;
    const dr = row - ripple.row;
    const dc = col - ripple.col;
    const timeSinceRipple = Date.now() - ripple.timestamp;
    const rippleRadius = Math.min(radius * 3, timeSinceRipple / 50); // Expand ripple over time

    return (
      (dc * dc) / (1.75 * rippleRadius * (1.75 * rippleRadius)) +
        (dr * dr) / (rippleRadius * rippleRadius) <=
      1
    );
  };

  const handleClick = (row: number, col: number) => {
    setRipple({ row, col, timestamp: Date.now() });
    // Clear ripple after animation
    setTimeout(() => setRipple(null), 1000);
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Please enter your email address"
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: "Successfully joined the waitlist!"
        });
        setEmail("");
      } else {
        setSubmitStatus({
          type: "error",
          message: data.error || "Failed to join waitlist"
        });
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Network error. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAsciiWithHover = () => {
    const elements: React.ReactNode[] = [];
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const char = paddedRows[row][col];
        if (char === "\n") continue;

        const inRadius = isWithinRadius(row, col);
        const inRippleRadius = isWithinRippleRadius(row, col);

        let className = "font-mono cursor-pointer transition-all duration-100";
        if (char === " ") {
          className += inRadius
            ? " text-neutral-700 bg-[#09090B]"
            : inRippleRadius
            ? " text-neutral-600 bg-neutral-800"
            : " text-[#09090B] hover:text-white";
          elements.push(
            <span
              key={`${row}-${col}`}
              className={className}
              onMouseEnter={() => setHovered({ row, col })}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handleClick(row, col)}
            >
              #
            </span>
          );
          continue;
        }
        className += inRadius
          ? " text-[#09090B] bg-white"
          : inRippleRadius
          ? " text-neutral-300 bg-neutral-700"
          : " text-white hover:text-[#09090B]";
        elements.push(
          <span
            key={`${row}-${col}`}
            className={className}
            onMouseEnter={() => setHovered({ row, col })}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleClick(row, col)}
          >
            {char}
          </span>
        );
      }
      elements.push(<br key={`br-${row}`} />);
    }
    return elements;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 gap-8">
      <pre
        className="
            font-mono 
            text-center 
            font-bold 
            leading-[1.1]
            text-[0.25rem] sm:text-[0.35rem]
            p-4 sm:p-8
            font-stretch-150%
            flex-shrink-0
          "
      >
        {renderAsciiWithHover()}
      </pre>
      <div className="max-w-md w-full">
        <h1 className="text-white text-2xl sm:text-4xl font-bold mb-2">Opus</h1>
        <p className="text-white text-sm sm:text-base mb-6">
          On-device computer use, fully in the background.
        </p>
        <form onSubmit={handleWaitlistSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="user@tryop.us"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            className="w-full text-sm sm:text-md p-3 border border-zinc-700 outline-none bg-zinc-900/80 text-white placeholder-zinc-500 transition-all focus:border-zinc-600 focus:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed app-region-no-drag rounded"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-sm sm:text-md p-3 bg-white text-black font-medium transition-all hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed app-region-no-drag rounded"
          >
            {isSubmitting ? "Joining..." : "Join Waitlist"}
          </button>

          {submitStatus.type && (
            <div
              className={`text-sm p-2 rounded ${
                submitStatus.type === "success"
                  ? "bg-green-900/20 text-green-400 border border-green-700"
                  : "bg-red-900/20 text-red-400 border border-red-700"
              }`}
            >
              {submitStatus.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default App;
