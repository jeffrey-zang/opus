"use client";

import { useState } from "react";

export default function Home() {
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

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

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
        let errorMessage = data.error || "Failed to join waitlist";

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          if (retryAfter) {
            errorMessage = `Rate limit exceeded. Please try again in ${retryAfter} seconds.`;
          } else {
            errorMessage = "Rate limit exceeded. Please try again later.";
          }
        }

        setSubmitStatus({
          type: "error",
          message: errorMessage
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
            text-white
          "
      >
        {asciiText}
      </pre>
      <div className="max-w-md w-full">
        <h1 className="text-white text-2xl sm:text-4xl font-bold mb-2">Opus</h1>
        <p className="text-white text-sm sm:text-base mb-6">
          Computers that act before you ask
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
            className="w-full text-sm sm:text-md p-3 bg-white text-black font-medium transition-all hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed app-region-no-drag rounded"
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
}
